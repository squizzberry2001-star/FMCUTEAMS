'use client';

import { useEffect, useState } from 'react';
import { useParams } from '@nso/routerShim';
import { Field } from '@nso/components/Field';
import { ImageInput } from '@nso/components/ImageInput';
import { CREW_LEVELS, CrewLevel, ReportData } from '@nso/lib/types';
import { findReportByToken, saveReport } from '@nso/lib/localStore';
import { getPublicStoreByToken, submitAudienceProfile, subscribeReportByToken, convex } from '@nso/lib/remoteStore';
import { makeCrew, syncCrewDependentRows } from '@nso/lib/reportDefaults';

export default function AudiencePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [report, setReport] = useState<ReportData | null>(null);
  const [name, setName] = useState('');
  const [nik, setNik] = useState('');
  const [level, setLevel] = useState<CrewLevel>('MG1');
  const [groomingPhoto, setGroomingPhoto] = useState('');
  const [message, setMessage] = useState('Loading audience dashboard...');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function load(fromRealtime = false) {
    let loaded: ReportData | null = null;
    try { loaded = await getPublicStoreByToken(token); } catch { /* fallback */ }
    loaded = loaded ?? findReportByToken(token);
    setReport(loaded ? syncCrewDependentRows(loaded) : null);
    setMessage(loaded ? (fromRealtime ? 'Data store terupdate realtime.' : 'Silakan isi data peserta.') : 'Link audience tidak valid atau database belum aktif.');
  }

  useEffect(() => {
    load();
    const unsubscribe = subscribeReportByToken(token, () => load(true));
    return unsubscribe;
  }, [token]);

  async function submitProfile() {
    if (!report) return;
    const missing: string[] = [];
    if (!name.trim()) missing.push('Nama');
    if (!nik.trim()) missing.push('NIK');
    if (!level) missing.push('Level');
    if (!groomingPhoto) missing.push('Foto Grooming');
    if (missing.length) {
      const text = `Data belum lengkap: ${missing.join(', ')}.`;
      setMessage(text);
      alert(text);
      return;
    }
    if (!/^\d+$/.test(nik)) {
      const text = 'NIK wajib angka.';
      setMessage(text);
      alert(text);
      return;
    }
    setSaving(true);
    const payload = { name: name.trim().toUpperCase(), nik, level, storeName: report.storeName, groomingPhotoUrl: groomingPhoto };
    try {
      await submitAudienceProfile(token, payload);
      if (!convex) {
        const existing = report.crews.find((crew) => crew.nik === nik);
        const nextCrews = existing
          ? report.crews.map((crew) => crew.nik === nik ? { ...crew, name: String(payload.name), level, groomingPhotoUrl: groomingPhoto, photoUrl: crew.photoUrl || groomingPhoto, createdSource: 'audience' as const } : crew)
          : [...report.crews, makeCrew({ name: String(payload.name), nik, level, groomingPhotoUrl: groomingPhoto, photoUrl: groomingPhoto, createdSource: 'audience' })];
        const next = syncCrewDependentRows({ ...report, crews: nextCrews });
        saveReport(next);
        setReport(next);
      }
      setSubmitted(true);
      setMessage('Data anda sudah masuk. Terima kasih.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan data peserta.');
    } finally {
      setSaving(false);
    }
  }

  if (!report) {
    return <main className="audience-shell"><section className="audience-card"><p>{message}</p></section></main>;
  }

  if (submitted) {
    return (
      <main className="audience-shell audience-success-shell">
        <section className="audience-card success-card">
          <div className="success-animation"><span>NSO</span><i>FamilyMart</i></div>
          <h1>Data anda sudah masuk</h1>
          <p className="notice">Terima kasih. Silakan menunggu instruksi fasilitator untuk simulasi berikutnya.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="audience-shell">
      <section className="audience-card flat-card">
        <p className="eyebrow">Peserta / Audience</p>
        <h1>{report.storeName}</h1>
        {message ? <p className="notice">{message}</p> : null}
        <div className="grid">
          <Field label="Nama"><input value={name} onChange={(e) => setName(e.target.value.toUpperCase())} autoCapitalize="characters" style={{ textTransform: 'uppercase' }} /></Field>
          <Field label="NIK"><input value={nik} inputMode="numeric" pattern="[0-9]*" onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Level"><select value={level} onChange={(e) => setLevel(e.target.value as CrewLevel)}>{CREW_LEVELS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <div className="field">
            <label>Upload Foto Grooming</label>
            <ImageInput storeId={report.id} label={groomingPhoto ? 'Ganti Foto Grooming' : 'Pilih Foto Grooming'} aspect="portrait" onUploaded={(urls) => { setGroomingPhoto(urls[0]); setMessage('Foto grooming siap disimpan.'); }} />
            {groomingPhoto ? <div className="cover-upload-box"><img src={groomingPhoto} className="cover-thumb" alt="Grooming" /><div className="upload-status ok">Checklist - foto sudah dipilih</div></div> : null}
          </div>
        </div>
        <button className="btn green full-btn" disabled={saving} onClick={submitProfile}>{saving ? 'Menyimpan...' : 'Simpan Data Peserta'}</button>
      </section>
    </main>
  );
}
