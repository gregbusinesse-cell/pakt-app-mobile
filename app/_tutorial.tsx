import { useState, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, SafeAreaView, Image, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, spacing, borderRadius } from '@/lib/theme'

const TUTORIAL_SLIDES = [
  {
    id: 'swipe',
    title: '🔄 Swipe',
    description: 'Glisse à droite (Like) ou à gauche (Dislike) pour explorer les profils et trouver tes partenaires business idéaux.',
    icon: 'swap-horizontal-outline',
    color: '#FFD700',
  },
  {
    id: 'matches',
    title: '❤️ Tes Matches',
    description: 'Accède à tous tes matchs ici. Un match se crée quand vous vous likez mutuellement!',
    icon: 'heart-outline',
    color: '#FF6B6B',
  },
  {
    id: 'messages',
    title: '💬 Messages',
    description: 'Communique avec tes matchs (disponible avec le plan Business). Discute de vos projets et objectifs communs.',
    icon: 'chatbubble-outline',
    color: '#4F46E5',
  },
  {
    id: 'profile',
    title: '👤 Profil',
    description: 'Modifie ton profil, tes photos, tes intérêts et tes préférences. Fais bonne impression!',
    icon: 'person-outline',
    color: '#10B981',
  },
  {
    id: 'settings',
    title: '⚙️ Paramètres',
    description: 'Gère tes plans d\'abonnement, événements, actualités et mentions légales. Tu peux aussi noter notre app ici!',
    icon: 'settings-outline',
    color: '#8B7355',
  },
]

export default function TutorialModal() {
  const router = useRouter()
  const { showTutorial: initialShowTutorial } = useLocalSearchParams<{ showTutorial?: string }>()
  const [visible, setVisible] = useState(initialShowTutorial === 'true')
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    checkTutorialStatus()
  }, [])

  const checkTutorialStatus = async () => {
    try {
      const seen = await AsyncStorage.getItem('PAKT_TUTORIAL_SEEN')
      if (!seen) {
        setVisible(true)
      }
    } catch (err) {
      console.error('Error checking tutorial status:', err)
    }
  }

  const handleNext = () => {
    if (currentSlide < TUTORIAL_SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1)
    }
  }

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem('PAKT_TUTORIAL_SEEN', 'true')
      setVisible(false)
    } catch (err) {
      console.error('Error saving tutorial status:', err)
    }
  }

  const slide = TUTORIAL_SLIDES[currentSlide]

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <SafeAreaView style={styles.container}>
        {/* Background with overlay */}
        <View style={styles.overlay} />

        {/* Tutorial Card */}
        <View style={styles.cardContainer}>
          <View style={[styles.card, { borderTopColor: slide.color, borderTopWidth: 4 }]}>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={handleFinish}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>

            {/* Icon Circle */}
            <View style={[styles.iconCircle, { backgroundColor: `${slide.color}20` }]}>
              <Ionicons name={slide.icon as any} size={56} color={slide.color} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{slide.title}</Text>

            {/* Description */}
            <Text style={styles.description}>{slide.description}</Text>

            {/* Slide Indicators */}
            <View style={styles.indicators}>
              {TUTORIAL_SLIDES.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.indicator,
                    idx === currentSlide && styles.indicatorActive,
                  ]}
                />
              ))}
            </View>

            {/* Navigation Buttons */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary, currentSlide === 0 && styles.buttonDisabled]}
                onPress={handlePrev}
                disabled={currentSlide === 0}
              >
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
                <Text style={styles.buttonText}>Précédent</Text>
              </TouchableOpacity>

              {currentSlide === TUTORIAL_SLIDES.length - 1 ? (
                <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleFinish}>
                  <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Commencer!</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.bg.primary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleNext}>
                  <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Suivant</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.bg.primary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Skip Button */}
            <TouchableOpacity onPress={handleFinish} style={styles.skipButton}>
              <Text style={styles.skipText}>Passer le tutoriel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  cardContainer: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: borderRadius.lg,
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    padding: spacing.md,
    zIndex: 10,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  indicators: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.muted,
  },
  indicatorActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing.lg,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.bg.quaternary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  buttonTextPrimary: {
    color: colors.bg.primary,
  },
  skipButton: {
    paddingVertical: spacing.md,
  },
  skipText: {
    fontSize: 13,
    color: colors.text.secondary,
    textDecorationLine: 'underline',
  },
})
