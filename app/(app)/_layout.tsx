import { Slot, usePathname, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef } from 'react'
import { Pressable, StyleSheet, Text, View, Platform, Animated } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNotificationCount } from '@/lib/hooks/useNotificationCount'
import { useActivityTracker } from '@/lib/hooks/useActivityTracker'
import { colors, spacing, borderRadius, shadows, transitions } from '@/lib/theme'
import TutorialModal from '@/app/_tutorial'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

type NavItem = {
  href: string
  label: string
  icon: IoniconName
  activeIcon: IoniconName
}

const NAV_ITEMS: NavItem[] = [
  { href: '/swipe',    label: 'Découvrir', icon: 'flame-outline',                 activeIcon: 'flame' },
  { href: '/matches',  label: 'Matchs',    icon: 'heart-outline',                 activeIcon: 'heart' },
  { href: '/messages', label: 'Messages',  icon: 'chatbubble-ellipses-outline',   activeIcon: 'chatbubble-ellipses' },
  { href: '/profile',  label: 'Profil',    icon: 'person-outline',                activeIcon: 'person' },
  { href: '/settings', label: 'PAKT',      icon: 'briefcase-outline',             activeIcon: 'briefcase' },
]

function NavButton({
  item,
  isActive,
  badgeCount,
  onPress,
}: {
  item: NavItem
  isActive: boolean
  badgeCount: number
  onPress: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isActive ? 1 : 0,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start()
  }, [isActive])

  const pillScale = scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] })
  const pillOpacity = scaleAnim

  return (
    <Pressable
      onPress={onPress}
      style={styles.tabItem}
      hitSlop={8}
      android_ripple={{ color: 'rgba(212,175,55,0.15)', borderless: true, radius: 40 }}
    >
      <View style={styles.tabInner}>
        {/* Active pill background */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activePill,
            {
              opacity: pillOpacity,
              transform: [{ scale: pillScale }],
            },
          ]}
        />

        <View style={styles.iconWrap}>
          <Ionicons
            name={isActive ? item.activeIcon : item.icon}
            size={24}
            color={isActive ? colors.bg.primary : colors.text.tertiary}
          />
          {badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
            </View>
          )}
        </View>

        <Text
          style={[styles.tabLabel, isActive && styles.tabLabelActive]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </View>
    </Pressable>
  )
}

export default function AppLayout() {
  const router   = useRouter()
  const pathname = usePathname() || ''
  const { messages, matchesAndLikes } = useNotificationCount()
  const insets = useSafeAreaInsets()

  useActivityTracker()

  return (
    // edges={['top']} only — the tab bar handles bottom safe area itself
    // so its background extends all the way to the screen edge (no gap)
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.content}>
        <Slot />
      </View>

      {/* Tutorial Modal - affiche au premier login */}
      <TutorialModal />

      <View style={styles.tabBarShadow}>
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const badgeCount =
              item.href === '/messages' ? messages :
              item.href === '/matches'  ? matchesAndLikes : 0

            return (
              <NavButton
                key={item.href}
                item={item}
                isActive={isActive}
                badgeCount={badgeCount}
                onPress={() => { if (!isActive) router.push(item.href as any) }}
              />
            )
          })}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
  },

  // Outer wrapper carries the elevation shadow (Android needs a separate
  // non-overflow:hidden container for shadows to render correctly)
  tabBarShadow: {
    backgroundColor: colors.bg.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.tertiary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 56,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  // Pronounced active state: solid gold pill behind the icon, like a
  // "selected chip" — gives weight & quality feel instead of a thin underline
  activePill: {
    position: 'absolute',
    top: 0,
    width: 52,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },

  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 36,
  },

  tabLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.text.disabled,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },

  badge: {
    position: 'absolute',
    top: -6,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg.secondary,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    zIndex: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
})
