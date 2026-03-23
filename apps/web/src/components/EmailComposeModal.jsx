import { useState, useEffect } from 'react';
import { bdApi } from '../lib/api.js';
import { inr } from '../lib/fmt.js';
import { Send, AlertCircle, CheckCircle, Mail } from 'lucide-react';

// ── Builds default HTML email body from a proposal object ─────────────────────
function buildEmailBody(proposal) {
  const c = proposal.content ?? {};
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const validUntil = new Date(Date.now() + (c.validity_days ?? 30) * 86400000)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<p>Dear ${proposal.contact_name ?? proposal.company_name},</p>

<p>Thank you for your interest in UnityESS Battery Energy Storage Systems. Please find below our budgetary proposal for your consideration.</p>

<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;margin:20px 0;">
  <tr style="background:#F26B4E;color:#fff;">
    <td colspan="2" style="padding:10px 14px;font-weight:bold;font-size:15px;">
      PROPOSAL SUMMARY — ${proposal.prop_number ?? `Version ${proposal.version}`}
    </td>
  </tr>
  <tr style="background:#fafafa;">
    <td style="padding:9px 14px;border-bottom:1px solid #eee;color:#888;width:40%;">Company</td>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;font-weight:600;">${proposal.company_name}</td>
  </tr>
  <tr>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;color:#888;">Opportunity</td>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;font-weight:600;">${proposal.opp_title}</td>
  </tr>
  <tr style="background:#fafafa;">
    <td style="padding:9px 14px;border-bottom:1px solid #eee;color:#888;">System Configuration</td>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;font-weight:600;">${c.units ?? '—'} × UESS-125-${c.unit_kwh ?? 261} (${c.total_kwh ?? '—'} kWh total)</td>
  </tr>
  ${c.scope_description ? `<tr>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;color:#888;">Scope</td>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;">${c.scope_description}</td>
  </tr>` : ''}
  <tr style="background:#fafafa;">
    <td style="padding:9px 14px;border-bottom:1px solid #eee;color:#888;">Net Value (Ex-GST)</td>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;font-weight:700;color:#F26B4E;">${inr(c.net_ex_gst)}</td>
  </tr>
  <tr>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;color:#888;">GST @ 18%</td>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;">${inr(c.gst_18)}</td>
  </tr>
  <tr style="background:#FEF2EF;">
    <td style="padding:10px 14px;color:#888;font-weight:700;">Total (Incl. GST)</td>
    <td style="padding:10px 14px;font-weight:800;font-size:16px;color:#F26B4E;">${inr(c.total_with_gst)}</td>
  </tr>
</table>

<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;margin:0 0 20px;">
  <tr style="background:#2D2D2D;color:#fff;">
    <td colspan="2" style="padding:10px 14px;font-weight:bold;">COMMERCIAL TERMS</td>
  </tr>
  <tr style="background:#fafafa;">
    <td style="padding:9px 14px;border-bottom:1px solid #eee;color:#888;width:40%;">Payment Terms</td>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;">${c.payment_terms ?? '—'}</td>
  </tr>
  <tr>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;color:#888;">Delivery</td>
    <td style="padding:9px 14px;border-bottom:1px solid #eee;">${c.delivery_weeks ?? '—'} weeks from receipt of advance</td>
  </tr>
  <tr style="background:#fafafa;">
    <td style="padding:9px 14px;color:#888;">Validity</td>
    <td style="padding:9px 14px;">Valid until <strong>${validUntil}</strong></td>
  </tr>
</table>

${c.notes ? `<p style="background:#fffbeb;border-left:3px solid #f59e0b;padding:10px 14px;margin:20px 0;font-size:13px;"><strong>Note:</strong> ${c.notes}</p>` : ''}

<p>All prices are exclusive of GST unless stated. This proposal is subject to final technical and commercial review. Please feel free to reach out for any clarifications.</p>

<p>We look forward to partnering with you on this project.</p>

<p>Warm regards,<br/>
<strong>Kedar Bala</strong><br/>
Product Manager — Battery Energy Storage Systems<br/>
Ornate Agencies Pvt. Ltd.<br/>
<a href="https://www.ornatesolar.com" style="color:#F26B4E;">www.ornatesolar.com</a></p>

<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>
<p style="font-size:11px;color:#aaa;">
  This email and any attachments are confidential and intended solely for the addressee.
  UnityESS is a registered brand of Ornate Agencies Pvt. Ltd., New Delhi.
</p>`;
}

// ── EmailComposeModal ─────────────────────────────────────────────────────────
export default function EmailComposeModal({ proposal, onClose, onSent, sentBy }) {
  const [form, setForm] = useState({
    to:      proposal.contact_email ?? '',
    cc:      '',
    subject: `UnityESS BESS Proposal — ${proposal.company_name} — ${proposal.prop_number ?? `v${proposal.version}`}`,
    body:    buildEmailBody(proposal),
  });
  const [emailStatus, setEmailStatus] = useState(null);   // { configured, from }
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    bdApi.emailStatus().then(r => setEmailStatus(r)).catch(() => {});
  }, []);

  async function handleSend() {
    if (!form.to) { setErr('Recipient email is required'); return; }
    if (!form.subject) { setErr('Subject is required'); return; }
    setSending(true);
    setErr('');
    try {
      await bdApi.sendEmail({
        proposal_id: proposal.id,
        to:       form.to.trim(),
        cc:       form.cc.trim() || undefined,
        subject:  form.subject,
        body:     form.body,
        sent_by:  sentBy ?? null,
      });
      setSent(true);
      if (onSent) onSent();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  }

  const inp = {
    border: '1px solid hsl(var(--border))', borderRadius: 7, padding: '8px 11px',
    fontSize: 13, fontFamily: "'Chivo', sans-serif", color: 'hsl(var(--foreground))',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const label = {
    fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    display: 'block', marginBottom: 4,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, padding: 20,
    }}>
      <div style={{
        background: 'hsl(var(--card))', borderRadius: 14, width: '100%', maxWidth: 720,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px 14px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: '#2563eb18', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Mail size={16} color="#2563eb" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Send Proposal via Email
              </h2>
              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                {proposal.prop_number ?? `Version ${proposal.version}`} · {proposal.company_name}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>×</button>
        </div>

        {/* Gmail config warning */}
        {emailStatus && !emailStatus.configured && (
          <div style={{
            margin: '12px 24px 0', background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e',
            display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0,
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Gmail not configured.</strong> Add your app password to <code>.env</code>:{' '}
              <code>GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx</code>
              <br />Generate one at{' '}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: '#92400e' }}>
                myaccount.google.com/apppasswords
              </a>
            </div>
          </div>
        )}
        {emailStatus?.configured && (
          <div style={{
            margin: '10px 24px 0', background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#15803d',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}>
            <CheckCircle size={14} />
            Sending from <strong style={{ marginLeft: 4 }}>{emailStatus.from}</strong>
          </div>
        )}

        {/* Sent confirmation */}
        {sent ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40,
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={30} color="#16a34a" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'hsl(var(--foreground))' }}>Email sent</div>
              <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
                Proposal marked as sent · Activity logged
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '9px 24px', background: '#2D2D2D', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'Chivo', sans-serif",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Form */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {err && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, color: '#dc2626', marginBottom: 14,
                }}>
                  {err}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={label}>To *</label>
                  <input
                    value={form.to}
                    onChange={e => set('to', e.target.value)}
                    placeholder="client@example.com"
                    style={inp}
                  />
                </div>
                <div>
                  <label style={label}>CC</label>
                  <input
                    value={form.cc}
                    onChange={e => set('cc', e.target.value)}
                    placeholder="manager@example.com"
                    style={inp}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={label}>Subject</label>
                <input
                  value={form.subject}
                  onChange={e => set('subject', e.target.value)}
                  style={inp}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...label, marginBottom: 0 }}>Email Body</label>
                  <button
                    onClick={() => setPreviewMode(p => !p)}
                    style={{
                      fontSize: 11, fontWeight: 700, color: '#2563eb',
                      background: 'none', border: '1px solid #bfdbfe', borderRadius: 6,
                      padding: '3px 10px', cursor: 'pointer', fontFamily: "'Chivo', sans-serif",
                    }}
                  >
                    {previewMode ? 'Edit HTML' : 'Preview'}
                  </button>
                </div>
                {previewMode ? (
                  <div style={{
                    border: '1px solid hsl(var(--border))', borderRadius: 8,
                    padding: '16px 20px', minHeight: 340, overflowY: 'auto',
                    background: 'hsl(var(--card))', fontSize: 13,
                  }}
                    dangerouslySetInnerHTML={{ __html: form.body }}
                  />
                ) : (
                  <textarea
                    value={form.body}
                    onChange={e => set('body', e.target.value)}
                    rows={16}
                    style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px', borderTop: '1px solid #f0f0f0', flexShrink: 0,
              display: 'flex', justifyContent: 'flex-end', gap: 10,
            }}>
              <button onClick={onClose} style={{
                padding: '9px 20px', border: '1px solid hsl(var(--border))', borderRadius: 8,
                background: 'hsl(var(--card))', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                fontFamily: "'Chivo', sans-serif",
              }}>
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || (emailStatus && !emailStatus.configured)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 20px', border: 'none', borderRadius: 8,
                  background: (sending || (emailStatus && !emailStatus.configured)) ? '#ccc' : '#2563eb',
                  color: '#fff', cursor: (sending || (emailStatus && !emailStatus.configured)) ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: "'Chivo', sans-serif",
                }}
              >
                <Send size={13} />
                {sending ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
