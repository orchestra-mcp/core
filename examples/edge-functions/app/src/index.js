import React from 'react'
import ReactDOM from 'react-dom'

import './index.css'

import { Auth } from '@supabase/auth-ui-react'

import App from './App'
import { supabase } from './utils/supabaseClient'

ReactDOM.render(
  <React.StrictMode>
    <Auth.UserContextProvider supabaseClient={supabase}>
      <App />
    </Auth.UserContextProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
