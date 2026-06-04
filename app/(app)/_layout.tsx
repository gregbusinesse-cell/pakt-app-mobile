import { Slot, usePathname, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNotificationCount } from '@/lib/hooks/useNotificationCount'
import { useActivityTracker } from '@/lib/hooks/useActivityTracker'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

type NavItem = {
  href: string
  label: string
  icon?: IoniconName
  isText?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/swipe',    label: 'Swipe',  icon: 'flame-outline' },
  { href: '/matches',  label: 'Matchs', icon: 'heart-outline' },
  { href: '/messages', label: 'Chat',   icon: 'chatbubble-ellipses-outline' },
  { href: '/profile',  label: 'Profil', icon: 'person-outline' },
  { href: '/settings', label: 'PAKT',   isText: true },
]

// Active icon variants (filled)
const ACTIVE_ICONS: Partial<Record<string, IoniconName>> = {
  'flame-outline':              'flame',
  'heart-outline':              'heart',
  'chatbubble-ellipses-outline':'chatbubble-ellipses',
  'person-outline':             'person',
}

export default function AppLayout() {
  const router   = useRouter()
  const pathname = usePathname() || ''
  const { messages, matchesAndLikes } = useNotificationCount()

  useActivityTracker()
  usePushNotifications()

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <View style={styles.content}>
        <Slot />
      </View>

      <View style={styles.tabBar}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const color    = isActive ? '#ffd700' : 'rgba(255,255,255,0.45)'

          const showBadge =
            (item.href === '/messages' && messages > 0) ||
            (item.href === '/matches'  && matchesAndLikes > 0)
          const badgeCount =
            item.href === '/messages' ? messages : matchesAndLikes

          // Pick filled icon when active, outline otherwise
          const iconName = item.icon
            ? (isActive ? (ACTIVE_ICONS[item.icon] ?? item.icon) : item.icon)
            : undefined

          return (
            <Pressable
              key={item.href}
              onPress={() => { if (!isActive) router.push(item.href as any) }}
              style={styles.tabItem}
              hitSlop={10}
            >
              {item.isText ? (
                /* ── PAKT text ── */
                <Text
                  style={[styles.paktText, { color: isActive ? '#ffd700' : 'rgba(255,215,0,0.55)' }]}
                  numberOfLines={1}
                >
                  PAKT
                </Text>
              ) : (
                /* ── Icon + optional badge ── */
                <View style={styles.iconWrap}>
                  <Ionicons name={iconName!} size={26} color={color} />
                  {showBadge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    minHeight: 58,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paktText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    // Prevent line wrapping
    includeFontPadding: false,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
})
