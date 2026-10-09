import React from 'react'
import './styles.css'

export const metadata = {
  title: 'Annoudio',
  description: 'Stories about the recordings of this organisation.',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  )
}
