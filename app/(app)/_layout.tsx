import { Slot, usePathname, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNotificationCount } from '@/lib/hooks/useNotificationCount'
import { useActivityTracker } from '@/lib/hooks/useActivityTracker'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

type NavItem = {
  href: string
  label: string
  icon?: IoniconName
  isText?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/swipe', label: 'Swipe', icon: 'flame' },
  { href: '/matches', label: 'Matchs', icon: 'heart' },
  { href: '/messages', label: 'Chat', icon: 'chatbubble-ellipses' },
  { href: '/profile', label: 'Profil', icon: 'person-circle' },
  { href: '/settings', label: 'PAKT', isText: true },
]

export default function AppLayout() {
  const router = useRouter()
  const pathname = usePathname() || ''
  const { messages, matchesAndLikes } = useNotificationCount()

  // Track user activity for online status
  useActivityTracker()

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <View style={styles.content}>
        <Slot />
      </View>

      <View style={styles.tabBar}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
          const color = isActive ? '#ffd700' : '#ffffff66'

          let badgeCount = 0
          let showBadge = false

          if (item.href === '/messages' && messages > 0) {
            showBadge = true
            badgeCount = messages
          } else if (item.href === '/matches' && matchesAndLikes > 0) {
            showBadge = true
            badgeCount = matchesAndLikes
          }

          return (
            <Pressable
              key={item.href}
              onPress={() => {
                if (!isActive) router.push(item.href as any)
              }}
              style={styles.tabItem}
              hitSlop={8}
            >
              <View style={styles.iconWrap}>
                {item.isText ? (
                  <Text
                    style={[
                      styles.paktText,
                      { color: isActive ? '#ffd700' : '#ffd700aa' },
                    ]}
                  >
                    PAKT
                  </Text>
                ) : (
                  <Ionicons name={item.icon!} size={24} color={color} />
                )}
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>

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
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 4 : 8,
    minHeight: 60,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  paktText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
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
