import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
// @ts-ignore - react-native-iap needs npm install
import * as RNIap from 'react-native-iap'
import { supabase } from '@/lib/supabase/client'

// iOS Product IDs (must match App Store Connect exactly)
const IOS_PRODUCT_IDS = {
  business: 'PAKT_BUSINESS_MONTHLY',
  business_pro: 'PAKT_BUSINESS_PRO_MONTHLY',
}

type PlanType = 'business' | 'business_pro'

export const useInAppPurchases = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize IAP connection
  useEffect(() => {
    if (Platform.OS !== 'ios') return

    const initIAP = async () => {
      try {
        await RNIap.initConnection()
        console.log('[IAP] Connection initialized')
      } catch (err) {
        console.error('[IAP] Init error:', err)
      }
    }

    initIAP()

    return () => {
      RNIap.endConnection().catch(console.error)
    }
  }, [])

  /**
   * Request a purchase from App Store
   */
  const requestPurchase = async (plan: PlanType) => {
    if (Platform.OS !== 'ios') {
      setError('In-App Purchase is only available on iOS')
      return null
    }

    setLoading(true)
    setError(null)

    try {
      const productId = IOS_PRODUCT_IDS[plan]
      if (!productId) throw new Error(`Invalid plan: ${plan}`)

      console.log('[IAP] Requesting purchase for:', productId)

      const result = await RNIap.requestPurchase({
        sku: productId,
        andDangerouslyFinishTransactionAutomatically: false,
      })

      console.log('[IAP] Purchase result:', result)

      if (!result || result.length === 0) {
        setError('Purchase cancelled')
        return null
      }

      const purchase = result[0]

      // Validate receipt with our backend
      const success = await validateReceiptWithBackend(
        purchase.transactionReceipt || purchase.originalJson || '',
        plan,
        purchase.transactionId || ''
      )

      if (success) {
        // Finish the transaction
        await RNIap.finishTransaction({
          purchase,
          isConsumable: false,
        })
        console.log('[IAP] Transaction finished')
        return { success: true, plan }
      } else {
        // Fail the transaction
        await RNIap.finishTransaction({
          purchase,
          isConsumable: false,
        })
        setError('Failed to validate receipt')
        return null
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[IAP] Purchase error:', errMsg)
      setError(errMsg)
      return null
    } finally {
      setLoading(false)
    }
  }

  /**
   * Validate receipt with Supabase backend
   */
  const validateReceiptWithBackend = async (
    receipt: string,
    plan: PlanType,
    transactionId: string
  ): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/validate-iap-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          receipt,
          plan,
          transactionId,
        }),
      })

      const data = await response.json()
      console.log('[IAP] Validation response:', data)

      return data.success === true
    } catch (err) {
      console.error('[IAP] Validation error:', err)
      return false
    }
  }

  return {
    loading,
    error,
    requestPurchase,
  }
}
