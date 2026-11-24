import { useEffect, useRef, useState } from 'react'
import { accountHint, api } from '../api'
import { newProject, normalizeReviewTarget, type Project } from '../model'
import { firstTemplate, fromTemplate, templates } from '../library/templates'
import { readProject, writeProject } from '../storage'

export function useDocument(id: string | undefined) {
  const [project, setProject] = useState<Project>()
  const [sync, setSync] = useState<'saving' | 'saved' | 'cloud' | 'error'>('saving')
  const [error, setError] = useState('')
  const [needsReviewLink, setNeedsReviewLink] = useState(false)
  const [initialTemplate, setInitialTemplate] = useState('')
  const [revision, setRevision] = useState(0)
  const active = useRef<Project | undefined>(undefined)
  const past = useRef<Project[]>([])
  const future = useRef<Project[]>([])
  const cloud = useRef<string | undefined>(undefined)
  const cloudTimeout = useRef<number | undefined>(undefined)

  function persist(value: Project) {
    setSync('saving')
    void writeProject(value).then(() => {
      if (active.current !== value) return
      setSync('saved')
      window.clearTimeout(cloudTimeout.current)
      const accountId = cloud.current
      if (accountId) cloudTimeout.current = window.setTimeout(() => {
        void api.saveProject(value).then(() => writeProject(value, accountId)).then(() => {
          if (active.current === value) setSync('cloud')
        }).catch(() => {})
      }, 2200)
    }).catch(() => {
      if (active.current === value) setSync('error')
    })
  }

  useEffect(() => {
    let mounted = true
    const open = async () => {
      const params = new URLSearchParams(location.search)
      const chosen = templates.find((template) => template.id === params.get('plantilla')) ?? firstTemplate
      let value: Project | undefined
      const hint = accountHint()
      let alreadyRetrieved = false
      if (id) {
        value = await readProject(id, hint?.id)
        if (!value && hint) {
          const session = await api.account()
          if (session.account) {
            const remote = await api.project(id).catch(() => undefined)
            value = remote?.project
            if (value) {
              await writeProject(value, session.account.id)
              alreadyRetrieved = true
            }
          }
        }
        if (!value) throw new Error('Ese proyecto no está disponible en este navegador.')
      } else {
        value = params.has('nuevo') ? newProject() : await fromTemplate(chosen)
      }
      if (!mounted) return
      const normalized = normalizeReviewTarget(value)
      if (normalized !== value) {
        setNeedsReviewLink(Boolean(value.url && !normalized.url))
        value = { ...normalized, updatedAt: new Date().toISOString() }
      }
      if (!id && !params.has('nuevo')) setInitialTemplate(chosen.id)
      active.current = value
      setProject(value)
      persist(value)
      if (!id) history.replaceState(null, '', `/editor/${value.id}`)
      if (hint) void api.account().then(async ({ account }) => {
        if (!mounted || !account) return
        cloud.current = account.id
        if (alreadyRetrieved && active.current === value) { setSync('cloud'); return }
        if (id && !alreadyRetrieved) {
          const revision = await api.revision(id).catch(() => undefined)
          if (!mounted) return
          const current = active.current
          if (revision && current && current === value && revision.updatedAt > current.updatedAt) {
            const remote = await api.project(id)
            if (!mounted || active.current !== current) return
            const newer = normalizeReviewTarget(remote.project)
            active.current = newer
            setProject(newer)
            await writeProject(newer, account.id)
            if (mounted && active.current === newer) setSync('cloud')
            return
          }
          if (revision && revision.updatedAt === active.current?.updatedAt) { setSync('cloud'); return }
        }
        if (active.current) persist(active.current)
      }).catch(() => {})
    }
    void open().catch((failure: Error) => { if (mounted) setError(failure.message) })
    return () => { mounted = false; window.clearTimeout(cloudTimeout.current) }
  }, [id])

  function apply(value: Project) {
    const updatedAt = new Date(Math.max(Date.now(), Date.parse(active.current?.updatedAt ?? '') + 1 || 0)).toISOString()
    const updated = { ...value, updatedAt }
    active.current = updated
    setProject(updated)
    setRevision((version) => version + 1)
    persist(updated)
  }
  function edit(fn: (before: Project) => Project) {
    const before = active.current
    if (!before) return
    const next = fn(before)
    if (next === before) return
    past.current = [...past.current.slice(-79), before]
    future.current = []
    apply(next)
  }
  function undo() {
    const before = past.current.pop()
    if (!before || !active.current) return
    future.current.push(active.current)
    apply(before)
  }
  function redo() {
    const next = future.current.pop()
    if (!next || !active.current) return
    past.current.push(active.current)
    apply(next)
  }

  return { project, active, sync, error, needsReviewLink, initialTemplate, edit, undo, redo, canUndo: past.current.length > 0,
    canRedo: future.current.length > 0, revision, recent: past.current }
}
