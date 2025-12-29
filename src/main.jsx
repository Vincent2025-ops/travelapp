import React from 'react'
import ReactDOM from 'react-dom/client'
import TravelApp from './travelapp_v9.jsx' // 👈 這裡必須對應您的檔名
import './index.css' // 👈 關鍵！一定要有這一行，不然畫面會變全白或只有純文字

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TravelApp />
  </React.StrictMode>,
)
