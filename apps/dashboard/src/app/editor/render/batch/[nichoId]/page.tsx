'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function RedirectToBatch() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    router.replace(`/editor/batch/${params.nichoId}`)
  }, [params.nichoId, router])

  return null
}
