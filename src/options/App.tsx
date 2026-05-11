import { useState } from 'react'
import { VaultProvider, useVault } from '../lib/useVault'
import { MasterPasswordForm } from '../components/MasterPasswordForm'
import { OrgForm } from '../components/OrgForm'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { createOrg, updateOrg, deleteOrg } from '../lib/orgs'
import type { Org } from '../lib/types'
import type { OrgInput } from '../lib/orgs'

const KIND_LABEL: Record<string, string> = {
  production: '本番',
  sandbox: 'Sandbox',
  mydomain: 'My Domain',
}
const KIND_COLOR: Record<string, string> = {
  production: '#0070d2',
  sandbox: '#27ae60',
  mydomain: '#8e44ad',
}

type EditState = { mode: 'add' } | { mode: 'edit'; org: Org } | null

function OptionsContent() {
  const { status, vault, error, initialize, unlock, lock, applyChange } = useVault()
  const [editState, setEditState] = useState<EditState>(null)

  if (status === 'loading') return <p style={{ color: '#888' }}>読み込み中...</p>
  if (status === 'uninitialized') return <MasterPasswordForm mode="initialize" onSubmit={initialize} error={error} />
  if (status === 'locked') return <MasterPasswordForm mode="unlock" onSubmit={unlock} error={error} />

  const orgs = vault?.orgs ?? []

  const handleSave = async (input: OrgInput) => {
    await applyChange(v =>
      editState?.mode === 'edit'
        ? updateOrg(v, editState.org.id, input)
        : createOrg(v, input)
    )
    setEditState(null)
  }

  const handleDelete = async (org: Org) => {
    if (!confirm(`「${org.label}」を削除しますか？`)) return
    await applyChange(v => deleteOrg(v, org.id))
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>SF Login Tool - 設定</h1>
        <button onClick={lock} style={s.lockBtn}>ロック</button>
      </header>

      {/* 組織管理セクション */}
      <section style={s.section}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>組織管理</h2>
          {!editState && (
            <button onClick={() => setEditState({ mode: 'add' })} style={s.addBtn}>+ 追加</button>
          )}
        </div>

        {editState ? (
          <OrgForm
            initial={editState.mode === 'edit' ? editState.org : undefined}
            onSave={handleSave}
            onCancel={() => setEditState(null)}
          />
        ) : orgs.length === 0 ? (
          <p style={s.empty}>登録されている組織はありません</p>
        ) : (
          <ul style={s.list}>
            {orgs.map(org => (
              <li key={org.id} style={s.listItem}>
                <div style={s.orgInfo}>
                  <span style={{ ...s.badge, background: KIND_COLOR[org.kind] }}>
                    {KIND_LABEL[org.kind]}
                  </span>
                  <div>
                    <div style={s.orgLabel}>{org.label}</div>
                    <div style={s.orgUser}>{org.username}</div>
                    {org.kind === 'mydomain' && <div style={s.orgUrl}>{org.myDomainUrl}</div>}
                  </div>
                </div>
                <div style={s.orgActions}>
                  <button onClick={() => setEditState({ mode: 'edit', org })} style={s.editBtn}>編集</button>
                  <button onClick={() => handleDelete(org)} style={s.deleteBtn}>削除</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* セキュリティセクション */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>セキュリティ</h2>
        <p style={s.hint}>マスターパスワードを変更します。変更後は新しいパスワードで解錠してください。</p>
        <ChangePasswordForm />
      </section>
    </div>
  )
}

export function App() {
  return (
    <VaultProvider>
      <OptionsContent />
    </VaultProvider>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 600, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 700, margin: 0 },
  lockBtn: { padding: '5px 12px', fontSize: 13, border: '1px solid #ccc', borderRadius: 5, background: '#f5f5f5', cursor: 'pointer' },
  section: { marginBottom: 40 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 700, margin: 0 },
  addBtn: { padding: '5px 14px', fontSize: 13, fontWeight: 600, background: '#0070d2', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' },
  empty: { color: '#999', fontSize: 13 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 8 },
  orgInfo: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  badge: { fontSize: 11, color: '#fff', padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap', marginTop: 2 },
  orgLabel: { fontSize: 14, fontWeight: 600 },
  orgUser: { fontSize: 12, color: '#666', marginTop: 2 },
  orgUrl: { fontSize: 11, color: '#999', marginTop: 1 },
  orgActions: { display: 'flex', gap: 6 },
  editBtn: { padding: '4px 10px', fontSize: 12, border: '1px solid #ccc', borderRadius: 4, background: '#f5f5f5', cursor: 'pointer' },
  deleteBtn: { padding: '4px 10px', fontSize: 12, border: '1px solid #fbb', borderRadius: 4, background: '#fff0f0', color: '#c0392b', cursor: 'pointer' },
  hint: { fontSize: 13, color: '#666', marginBottom: 10 },
}
