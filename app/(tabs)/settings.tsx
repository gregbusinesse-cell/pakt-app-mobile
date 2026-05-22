import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/lib/store';
import { Colors } from '@/constants/theme';
import { normalizePlan } from '@/lib/utils';

type TabKey = 'plans' | 'events' | 'news' | 'legal';

const PLANS = [
  {
    key: 'free' as const,
    name: 'Free',
    price: 'Gratuit',
    features: [
      'Swipes illimites',
      'Likes illimites',
      'Voir ses matchs',
      'Profil personnalise',
    ],
  },
  {
    key: 'business' as const,
    name: 'Business',
    price: '4,99 / mois',
    features: [
      'Tout du plan Free',
      'Messagerie illimitee',
      'Conversations deverrouillees',
      'Badge Business',
    ],
  },
  {
    key: 'business_pro' as const,
    name: 'Business Pro',
    price: '9,99 / mois',
    features: [
      'Tout du plan Business',
      'Voir qui t\'a like',
      'Annuler un swipe',
      'Criteres avances (distance, age, competences)',
      'Badge Pro',
    ],
  },
];

const CHANGELOG = [
  {
    version: 'v1.0.0',
    date: 'Mai 2025',
    summary: 'Lancement de PAKT Mobile',
    changes: [
      'Application mobile iOS',
      'Decouverte de profils par swipe',
      'Matchs et likes',
      'Messagerie en temps reel',
      'Profils avec photos, bio et competences',
    ],
  },
];

export default function SettingsScreen() {
  const { profile } = useAppStore();
  const [tab, setTab] = useState<TabKey>('plans');
  const currentPlan = normalizePlan(profile?.plan);

  const handleSubscribe = (planKey: string) => {
    if (planKey === currentPlan) return;
    if (planKey === 'free') {
      Alert.alert(
        'Annuler l\'abonnement',
        'Tu peux gerer ton abonnement depuis les reglages de ton compte Apple.',
        [
          { text: 'OK' },
          {
            text: 'Ouvrir les reglages',
            onPress: () => Linking.openURL('https://apps.apple.com/account/subscriptions'),
          },
        ],
      );
      return;
    }

    // Apple In-App Purchase would be triggered here
    Alert.alert(
      'Abonnement',
      `L'abonnement ${planKey === 'business' ? 'Business' : 'Business Pro'} sera disponible via Apple In-App Purchase.`,
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reglages</Text>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {(['plans', 'events', 'news', 'legal'] as TabKey[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabItemText, tab === t && styles.tabItemTextActive]}>
              {t === 'plans'
                ? 'Plans'
                : t === 'events'
                  ? 'Evenements'
                  : t === 'news'
                    ? 'Nouveautes'
                    : 'Legal'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'plans' && (
          <View style={styles.plansContainer}>
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              return (
                <View
                  key={plan.key}
                  style={[
                    styles.planCard,
                    isCurrent && styles.planCardActive,
                  ]}
                >
                  {isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Plan actuel</Text>
                    </View>
                  )}
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <View style={styles.planFeatures}>
                    {plan.features.map((feat, i) => (
                      <View key={i} style={styles.featureRow}>
                        <Ionicons name="checkmark" size={16} color={Colors.gold} />
                        <Text style={styles.featureText}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                  {!isCurrent && plan.key !== 'free' && (
                    <TouchableOpacity
                      style={styles.subscribeButton}
                      onPress={() => handleSubscribe(plan.key)}
                    >
                      <Text style={styles.subscribeText}>
                        Passer a {plan.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {isCurrent && plan.key !== 'free' && (
                    <TouchableOpacity
                      style={styles.manageButton}
                      onPress={() =>
                        Linking.openURL('https://apps.apple.com/account/subscriptions')
                      }
                    >
                      <Text style={styles.manageText}>Gerer l'abonnement</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {tab === 'events' && (
          <View style={styles.eventCard}>
            <Ionicons name="calendar-outline" size={40} color={Colors.gold} />
            <Text style={styles.eventTitle}>Evenements PAKT</Text>
            <Text style={styles.eventDesc}>
              Des rencontres reelles entre membres ambitieux pour creer des connexions utiles
              et developper son reseau.
            </Text>
            <Text style={styles.eventSoon}>Bientot disponible</Text>
          </View>
        )}

        {tab === 'news' && (
          <View style={styles.changelogContainer}>
            <Text style={styles.changelogLabel}>Changelog</Text>
            {CHANGELOG.map((release) => (
              <View key={release.version} style={styles.releaseCard}>
                <View style={styles.releaseHeader}>
                  <Text style={styles.releaseVersion}>{release.version}</Text>
                  <Text style={styles.releaseDate}>{release.date}</Text>
                </View>
                <Text style={styles.releaseSummary}>{release.summary}</Text>
                {release.changes.map((change, i) => (
                  <View key={i} style={styles.changeRow}>
                    <View style={styles.changeDot} />
                    <Text style={styles.changeText}>{change}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {tab === 'legal' && (
          <View style={styles.legalContainer}>
            <TouchableOpacity style={styles.legalRow}>
              <Ionicons name="document-text-outline" size={20} color="rgba(255,255,255,0.5)" />
              <Text style={styles.legalText}>Conditions Generales d'Utilisation</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.legalRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color="rgba(255,255,255,0.5)" />
              <Text style={styles.legalText}>Politique de Confidentialite</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.legalRow}>
              <Ionicons name="mail-outline" size={20} color="rgba(255,255,255,0.5)" />
              <Text style={styles.legalText}>Contact</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
            <View style={styles.appInfo}>
              <Text style={styles.appInfoText}>PAKT v1.0.0</Text>
              <Text style={styles.appInfoText}>Le Tinder du Business</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark200,
  },
  tabItemActive: {
    backgroundColor: Colors.gold,
  },
  tabItemText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabItemTextActive: {
    color: Colors.dark,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  plansContainer: {
    gap: 16,
  },
  planCard: {
    backgroundColor: Colors.dark200,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark400,
    padding: 20,
  },
  planCardActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,168,83,0.05)',
  },
  currentBadge: {
    backgroundColor: 'rgba(212,168,83,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  currentBadgeText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  planName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  planPrice: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  planFeatures: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  subscribeButton: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  subscribeText: {
    color: Colors.dark,
    fontSize: 15,
    fontWeight: '700',
  },
  manageButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  manageText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  eventCard: {
    backgroundColor: Colors.dark200,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,168,83,0.2)',
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  eventDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  eventSoon: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  changelogContainer: {
    gap: 16,
  },
  changelogLabel: {
    color: 'rgba(212,168,83,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  releaseCard: {
    backgroundColor: Colors.dark200,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  releaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  releaseVersion: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  releaseDate: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  releaseSummary: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 4,
  },
  changeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: 6,
  },
  changeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
  legalContainer: {
    gap: 2,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark400,
  },
  legalText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    flex: 1,
  },
  appInfo: {
    alignItems: 'center',
    paddingTop: 32,
    gap: 4,
  },
  appInfoText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
  },
});
