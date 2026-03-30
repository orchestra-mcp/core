import 'react-native-url-polyfill/auto'

import { JwtPayload } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import Auth from './components/Auth'
import { supabase } from './lib/supabase'

export default function App() {
  const [claims, setClaims] = useState<JwtPayload | null>(null)

  useEffect(() => {
    supabase.auth.getClaims().then(({ data: { claims } }) => {
      setClaims(claims)
    })

    supabase.auth.onAuthStateChange(() => {
      supabase.auth.getClaims().then(({ data: { claims } }) => {
        setClaims(claims)
      })
    })
  }, [])

  return (
    <View>
      <Auth />
      {claims && <Text>{claims.sub}</Text>}
    </View>
  )
}
