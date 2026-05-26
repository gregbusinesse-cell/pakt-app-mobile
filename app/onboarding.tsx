import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions,
  SafeAreaView, Image, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase/client'

const { width } = Dimensions.get('window')

const SLIDES = [
  {
    icon: 'heart',
    title: 'Bienvenue sur PAKT',
    description: 'Connectez-vous avec des professionnels qui partagent vos intérêts et vos ambitions',
    color: '#ffd700',
  },
  {
    icon: 'images',
    title: 'Créez votre profil',
    description: 'Ajoutez vos photos, votre bio et vos intérêts pour attirer les bonnes personnes',
    color: '#4caf50',
  },
  {
    icon: 'flame',
    title: 'Commencez à swiper',
    description: 'Découvrez des profils et laissez les personnes qui vous plaisent vous trouver',
    color: '#ff9800',
  },
  {
    icon: 'chatbubbles',
    title: 'Engagez une conversation',
    description: 'Matchées? Commencez à discuter et établissez des connexions précieuses',
    color: '#2196f3',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [completing, setCompleting] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const slide = SLIDES[currentSlide]

  const handleNextSlide = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1)
      scrollRef.current?.scrollTo({ x: width * (currentSlide + 1), animated: true })
    }
  }

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
      scrollRef.current?.scrollTo({ x: width * (currentSlide - 1), animated: true })
    }
  }

  const handleSkipOnboarding = async () => {
    try {
      setCompleting(true)
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user?.id) {
        await supabase
          .from('profiles')
          .update({ is_onboarded: true })
          .eq('id', session.user.id)
      }

      router.replace('/(app)/swipe' as any)
    } catch (err) {
      console.error('Error completing onboarding:', err)
    } finally {
      setCompleting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip Button */}
      <View style={styles.header}>
        <Text style={styles.stepText}>
          {currentSlide + 1} / {SLIDES.length}
        </Text>
        <TouchableOpacity onPress={handleSkipOnboarding} disabled={completing}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.slides}
      >
        {SLIDES.map((item, idx) => (
          <View key={idx} style={[styles.slide, { width }]}>
            <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon as any} size={80} color={item.color} />
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Progress Dots */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.dot,
              idx === currentSlide && styles.dotActive,
              idx === currentSlide && { backgroundColor: slide.color },
            ]}
            onPress={() => {
              setCurrentSlide(idx)
              scrollRef.current?.scrollTo({ x: width * idx, animated: true })
            }}
          />
        ))}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.navButton, { opacity: currentSlide === 0 ? 0.3 : 1 }]}
          onPress={handlePrevSlide}
          disabled={currentSlide === 0}
        >
          <Ionicons name="chevron-back" size={24} color="#ffd700" />
        </TouchableOpacity>

        {currentSlide === SLIDES.length - 1 ? (
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: slide.color }]}
            onPress={handleSkipOnboarding}
            disabled={completing}
          >
            {completing ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Text style={styles.ctaButtonText}>Commencer</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: slide.color }]}
            onPress={handleNextSlide}
          >
            <Text style={styles.ctaButtonText}>Suivant</Text>
            <Ionicons name="arrow-forward" size={18} color="#000" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.navButton, { opacity: currentSlide === SLIDES.length - 1 ? 0.3 : 1 }]}
          onPress={handleNextSlide}
          disabled={currentSlide === SLIDES.length - 1}
        >
          <Ionicons name="chevron-forward" size={24} color="#ffd700" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  stepText: { color: '#ffd700', fontSize: 13, fontWeight: '700' },
  skipText: { color: '#ffffff66', fontSize: 13, fontWeight: '600' },

  slides: { flex: 1 },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },

  iconBox: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: { color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  description: {
    color: '#ffffff88',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },

  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  dotActive: { width: 24, backgroundColor: '#ffd700' },

  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  ctaButton: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  ctaButtonText: { color: '#000', fontSize: 15, fontWeight: '700' },
})
