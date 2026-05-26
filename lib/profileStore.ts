/**
 * ProfileStore — store global partagé entre tous les composants.
 * Évite les problèmes de synchronisation entre instances séparées de hooks.
 */

import type { Database } from './supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Listener = (profile: Profile | null) => void

class ProfileStore {
  private _profile: Profile | null = null
  private _listeners = new Set<Listener>()

  get profile(): Profile | null {
    return this._profile
  }

  set(profile: Profile | null) {
    this._profile = profile
    this._listeners.forEach(fn => fn(profile))
  }

  subscribe(fn: Listener): () => void {
    this._listeners.add(fn)
    return () => this._listeners.delete(fn)
  }
}

export const profileStore = new ProfileStore()
