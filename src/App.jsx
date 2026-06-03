import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Shield, Laptop, Users, FileText, Truck, Wrench, BarChart3, Settings, Bell, LogOut, Package, ClipboardList, AlertTriangle, CheckCircle, XCircle, Mail, Lock, Eye, EyeOff } from 'lucide-react'

const API_URL = 'http://localhost:3001/api'

// Auth Context
function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))

  useEffect(() => {
    if (token) {
      const savedUser = localStorage.getItem('user')
      if (savedUser) setUser(JSON.parse(savedUser))
    }
  }, [token])

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (res.ok) {
      setToken(data.token)
      setUser(data.user)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      return true
    }
    throw new Error(data.error)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return { user, token, login, logout }
}

// API Helper
async function fetchAPI(endpoint, options = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  })
  if (!res.ok) {
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      throw new Error(json.error || json.message || 'Request failed')
    } catch {
      throw new Error(text || `HTTP error ${res.status}`)
    }
  }
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

// ==========================================
// PUBLIC PAGES - No Auth Required
// ==========================================

// Login Page
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>D03 AMS</h1>
          <p>D03 Asset Management System</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="badge badge-danger" style={{ marginBottom: 16, display: 'block', textAlign: 'center' }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" required style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
            <a href="/vendor-sla" style={{ color: 'var(--primary)' }}>Register as Vendor</a>
          </p>
        </form>
      </div>
    </div>
  )
}

// Forgot Password Page
function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleRequestReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(data.message)
        setResetToken(data.reset_token)
      } else {
        setMessage(data.error)
      }
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: newPassword })
      })
      const data = await res.json()
      if (res.ok) {
        alert('Password reset successfully! Please login.')
        window.location.href = '/login'
      } else {
        setMessage(data.error)
      }
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>D03 AMS</h1>
          <p>Reset Password</p>
        </div>
        {!resetToken ? (
          <form onSubmit={handleRequestReset}>
            {message && <div className="badge badge-warning" style={{ marginBottom: 16, display: 'block', textAlign: 'center' }}>{message}</div>}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            {message && <div className="badge badge-warning" style={{ marginBottom: 16, display: 'block', textAlign: 'center' }}>{message}</div>}
            <p style={{ fontSize: 12, marginBottom: 16, color: 'var(--text-secondary)' }}>Token received. Enter your new password:</p>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} className="form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" required style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
          <a href="/login" style={{ color: 'var(--primary)' }}>Back to Login</a>
        </p>
      </div>
    </div>
  )
}

// Employee Public Report Page (accessed via email link)
function EmployeeReportPage() {
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [formData, setFormData] = useState({ issue_condition: 'good', report_type: 'no_issues', description: '' })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('verify') // 'verify' or 'report'
  const [employeeEmail, setEmployeeEmail] = useState('')

  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const deviceId = params.get('device_id')

    if (!token) {
      setError('Invalid report link - missing token')
      setLoading(false)
      return
    }

    // Just verify token exists (without email check initially)
    fetch(`${API_URL}/public/verify-token?token=${token}${deviceId ? '&device_id=' + deviceId : ''}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setDeviceInfo(data.allocation)
          // Pre-fill email if provided in URL
          const urlEmail = params.get('email')
          if (urlEmail) {
            setEmployeeEmail(urlEmail)
          }
        } else {
          setError(data.error || 'Invalid verification link')
        }
      })
      .catch(err => setError('Invalid verification link'))
      .finally(() => setLoading(false))
  }, [])

  const handleVerifyEmail = async (e) => {
    e.preventDefault()
    setError('')

    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const deviceId = params.get('device_id')

    try {
      // Verify token + email combination
      const res = await fetch(`${API_URL}/public/verify-token?token=${token}&email=${encodeURIComponent(employeeEmail)}${deviceId ? '&device_id=' + deviceId : ''}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      setDeviceInfo(data.allocation)
      setStep('report')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const deviceId = params.get('device_id')

    try {
      const res = await fetch(`${API_URL}/public/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: employeeEmail,
          device_id: deviceId,
          issue_condition: formData.issue_condition,
          report_type: formData.report_type,
          description: formData.description
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p style={{ textAlign: 'center' }}>Verifying your access...</p>
        </div>
      </div>
    )
  }

  if (error && step === 'verify') {
    return (
      <div className="login-page">
        <div className="login-card">
          <h2 style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</h2>
          <p style={{ textAlign: 'center', marginTop: 16 }}>
            <a href="/" style={{ color: 'var(--primary)' }}>Go to Login</a>
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={48} color="var(--success)" />
            <h2 style={{ marginTop: 16 }}>Device Verified & Report Submitted</h2>
            <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>Thank you for confirming receipt of your device. Your report has been submitted. Procurement will review it shortly.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 500 }}>
        <div className="login-logo">
          <h1>D03 AMS</h1>
          <p>{step === 'verify' ? 'Verify Your Identity' : 'Device Verification Report'}</p>
        </div>

        {deviceInfo && step === 'report' && (
          <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
            <p><strong>Device:</strong> {deviceInfo.asset_tag} - {deviceInfo.model}</p>
            <p><strong>Serial:</strong> {deviceInfo.serial_number}</p>
            <p><strong>Brand:</strong> {deviceInfo.brand}</p>
          </div>
        )}

        {step === 'verify' ? (
          <form onSubmit={handleVerifyEmail}>
            {error && <div className="badge badge-danger" style={{ marginBottom: 16, display: 'block' }}>{error}</div>}
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
              Please enter your email address to verify your identity and access the device report form.
            </p>
            <div className="form-group">
              <label className="form-label">Your Email Address *</label>
              <input
                type="email"
                className="form-input"
                value={employeeEmail}
                onChange={e => setEmployeeEmail(e.target.value)}
                placeholder="Enter your work email"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Verify & Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="badge badge-danger" style={{ marginBottom: 16, display: 'block' }}>{error}</div>}

            <div className="form-group">
              <label className="form-label">Device Condition *</label>
              <select className="form-select" value={formData.issue_condition} onChange={e => setFormData({...formData, issue_condition: e.target.value})}>
                <option value="good">Good - Device is working properly</option>
                <option value="fair">Fair - Minor issues</option>
                <option value="poor">Poor - Needs attention</option>
                <option value="damaged">Damaged - Needs repair/replacement</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Issue Type</label>
              <select className="form-select" value={formData.report_type} onChange={e => setFormData({...formData, report_type: e.target.value})}>
                <option value="no_issues">No Issues</option>
                <option value="hardware_issue">Hardware Issue</option>
                <option value="software_issue">Software Issue</option>
                <option value="damage">Physical Damage</option>
                <option value="performance">Performance Issue</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description {formData.report_type !== 'no_issues' ? '*' : ''}</label>
              <textarea
                className="form-textarea"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder={formData.report_type === 'no_issues' ? 'Optional notes...' : 'Describe the issue in detail...'}
                required={formData.report_type !== 'no_issues'}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Submit Report
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// Password Reset Page (accessed via email link)
function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        setMessage('Password set successfully! You can now login.')
      } else {
        setMessage(data.error)
      }
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <h1>Invalid Link</h1>
            <p>This password reset link is invalid or has expired.</p>
          </div>
          <a href="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>Back to Login</a>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <h1>Success!</h1>
            <p>{message}</p>
          </div>
          <a href="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>Go to Login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>Set Your Password</h1>
          <p>Create a password to access the vendor portal</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>

          {message && (
            <div style={{ padding: 10, background: success ? '#d4edda' : '#f8d7da', color: success ? '#155724' : '#721c24', borderRadius: 4, marginBottom: 15 }}>
              {message}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Setting Password...' : 'Set Password'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
          <a href="/login" style={{ color: 'var(--primary)' }}>Back to Login</a>
        </p>
      </div>
    </div>
  )
}

// Vendor Registration - SLA Page
function VendorSLAPage() {
  const [sla, setSLA] = useState(null)
  const [signature, setSignature] = useState('')
  const [signatureFile, setSignatureFile] = useState(null)
  const [signaturePreview, setSignaturePreview] = useState('')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadSLA()
  }, [])

  const loadSLA = async () => {
    try {
      const res = await fetch(`${API_URL}/public/sla`)
      if (!res.ok) {
        throw new Error(`Failed to load SLA: HTTP ${res.status}`)
      }
      const data = await res.json()
      setSLA(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSignatureFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setSignaturePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!response) {
      alert('Please select an option')
      return
    }
    if (!signature && !signaturePreview) {
      alert('Please provide your signature')
      return
    }
    setSubmitting(true)
    try {
      const vendorId = localStorage.getItem('pending_vendor_id') || 'temp-' + Date.now()
      await fetch(`${API_URL}/vendor/sla-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          signature_data: signaturePreview || signature,
          response: response,
          signature_name: signature || 'Vendor Signature'
        })
      })

      if (response === 'agreed') {
        window.location.href = `/vendor-register?step=details&vendor_id=${vendorId}`
      } else if (response === 'disagreed') {
        alert('Thank you for your response. We will be in touch.')
        window.location.href = '/login'
      } else if (response === 'request_modify') {
        alert('We have received your modification request. We will contact you.')
        window.location.href = '/login'
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="login-page"><div className="login-card">Loading...</div></div>

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="login-logo">
          <h1>Service Level Agreement</h1>
          <p>{sla?.title || 'D03 Asset Management System'}</p>
        </div>

        <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 8, marginBottom: 20, maxHeight: 300, overflow: 'auto' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, margin: 0 }}>{sla?.content}</pre>
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #ddd', textAlign: 'center' }}>
            {sla?.ceo_signature && (
              <div style={{ marginBottom: 12 }}>
                <img src={sla.ceo_signature} alt="IT Manager Signature" style={{ maxWidth: 200, maxHeight: 80, border: '1px solid #ccc', padding: 5 }} />
              </div>
            )}
            <div style={{ color: 'var(--primary)', fontSize: 16 }}>
              {sla?.ceo_name || 'DR Orlando Olumide Odejide'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              IT Manager
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Upload Your Signature</label>
              <input type="file" accept="image/*" className="form-input" onChange={handleSignatureUpload} style={{ padding: 8 }} />
              {signaturePreview && (
                <div style={{ marginTop: 10 }}>
                  <img src={signaturePreview} alt="Signature preview" style={{ maxWidth: 200, maxHeight: 80, border: '1px solid #ccc', padding: 5 }} />
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Or Type Your Name as Signature</label>
              <input type="text" className="form-input" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type your full name as signature" />
            </div>

            <div style={{ marginTop: 20 }}>
              <p style={{ fontWeight: 500, marginBottom: 12 }}>Do you agree to the terms of this SLA?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className={`btn ${response === 'agreed' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setResponse('agreed')} style={{ flex: 1 }}>
                  <CheckCircle size={18} /> Agree
                </button>
                <button type="button" className={`btn ${response === 'disagreed' ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setResponse('disagreed')} style={{ flex: 1 }}>
                  <XCircle size={18} /> Disagree
                </button>
                <button type="button" className={`btn ${response === 'request_modify' ? 'btn-warning' : 'btn-secondary'}`} onClick={() => setResponse('request_modify')} style={{ flex: 1 }}>
                  <FileText size={18} /> Request Modify
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={submitting || !response}>
              {submitting ? 'Submitting...' : 'Submit Response'}
            </button>
          </form>
        </div>

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
          <a href="/login" style={{ color: 'var(--primary)' }}>Back to Login</a>
        </p>
      </div>
    </div>
  )
}

// Employee Confirm Device Condition Page
function EmployeeConfirmDevicePage() {
  const [reportInfo, setReportInfo] = useState(null)
  const [formData, setFormData] = useState({ condition_confirmed: true, condition_notes: '' })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [step, setStep] = useState('verify')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reportId = params.get('report_id')

    if (!reportId) {
      setError('Invalid confirmation link - missing report ID')
      setLoading(false)
      return
    }

    // Just check if the report exists and is in the right status
    fetch(`${API_URL}/employee/reports`)
      .then(r => r.json())
      .then(data => {
        const report = data.find(r => r.id === reportId && r.status === 'awaiting_employee_confirmation')
        if (report) {
          setReportInfo(report)
          const urlEmail = params.get('email')
          if (urlEmail) {
            setEmail(urlEmail)
            setStep('confirm')
          }
        } else {
          setError('Report not found or not awaiting confirmation')
        }
      })
      .catch(err => setError('Invalid confirmation link'))
      .finally(() => setLoading(false))
  }, [])

  const handleVerifyEmail = async (e) => {
    e.preventDefault()
    setError('')

    const params = new URLSearchParams(window.location.search)
    const reportId = params.get('report_id')

    try {
      const res = await fetch(`${API_URL}/employee/reports`)
      const data = await res.json()
      const report = data.find(r => r.id === reportId && r.status === 'awaiting_employee_confirmation')

      if (!report || (report.employee_email !== email && report.work_email !== email)) {
        throw new Error('Email does not match records for this report')
      }

      setReportInfo(report)
      setStep('confirm')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const params = new URLSearchParams(window.location.search)
    const reportId = params.get('report_id')

    const token = localStorage.getItem('token')
    if (!token) {
      setError('Please log in to confirm device condition')
      setTimeout(() => window.location.href = '/login', 2000)
      return
    }

    try {
      const res = await fetch(`${API_URL}/employee/reports/${reportId}/confirm-condition`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p style={{ textAlign: 'center' }}>Verifying your access...</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <CheckCircle size={48} style={{ color: 'var(--success)' }} />
          <h2 style={{ marginTop: 16 }}>Device Condition Confirmed</h2>
          <p>Thank you for confirming your device condition.</p>
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
            <a href="/login" style={{ color: 'var(--primary)' }}>Go to Login</a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>D03 AMS</h1>
          <p>Confirm Device Condition</p>
        </div>

        {error && <div className="badge badge-danger" style={{ marginBottom: 16, display: 'block', textAlign: 'center' }}>{error}</div>}

        {step === 'verify' && (
          <form onSubmit={handleVerifyEmail}>
            <div className="form-group">
              <label className="form-label">Enter your email to verify</label>
              <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your work email" required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Verify</button>
          </form>
        )}

        {step === 'confirm' && reportInfo && (
          <form onSubmit={handleSubmit}>
            <div style={{ background: '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <p><strong>Asset Tag:</strong> {reportInfo.asset_tag}</p>
              <p><strong>Model:</strong> {reportInfo.model}</p>
              <p><strong>Issue Reported:</strong> {reportInfo.description}</p>
            </div>

            <div className="form-group">
              <label className="form-label">Is your device in good condition after repair?</label>
              <select className="form-input" value={formData.condition_confirmed} onChange={(e) => setFormData({ ...formData, condition_confirmed: e.target.value === 'true' })}>
                <option value={true}>Yes, device is in good condition</option>
                <option value={false}>No, there are still issues</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" value={formData.condition_notes} onChange={(e) => setFormData({ ...formData, condition_notes: e.target.value })} placeholder="Any notes about the device condition..." rows={3} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Confirm Condition</button>
          </form>
        )}

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
          <a href="/login" style={{ color: 'var(--primary)' }}>Back to Login</a>
        </p>
      </div>
    </div>
  )
}

// Vendor Registration - Details Page
function VendorRegisterPage() {
  const [step, setStep] = useState('details')
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', company_location: '', address: '',
    products: [{ name: '', category: 'laptop', description: '' }]
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const addProduct = () => {
    setFormData({
      ...formData,
      products: [...formData.products, { name: '', category: 'laptop', description: '' }]
    })
  }

  const removeProduct = (index) => {
    setFormData({
      ...formData,
      products: formData.products.filter((_, i) => i !== index)
    })
  }

  const updateProduct = (index, field, value) => {
    const updated = [...formData.products]
    updated[index][field] = value
    setFormData({ ...formData, products: updated })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/vendor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (res.ok) {
        alert('Registration submitted successfully! You will receive an email to set your password.')
        navigate('/login')
      } else {
        alert(data.error)
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 700 }}>
        <div className="login-logo">
          <h1>Vendor Registration</h1>
          <p>Complete Your Profile</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Company Name *</label>
            <input type="text" className="form-input" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="tel" className="form-input" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Company Location *</label>
            <input type="text" className="form-input" value={formData.company_location} onChange={(e) => setFormData({...formData, company_location: e.target.value})} placeholder="City, Country" required />
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-textarea" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 20 }}>
            <h4 style={{ marginBottom: 16 }}>Products You Sell</h4>
            {formData.products.map((product, index) => (
              <div key={index} style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 500 }}>Product {index + 1}</span>
                  {formData.products.length > 1 && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeProduct(index)}>Remove</button>
                  )}
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Product Name</label>
                    <input type="text" className="form-input" value={product.name} onChange={(e) => updateProduct(index, 'name', e.target.value)} placeholder="e.g., Dell Laptop, HP Printer" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={product.category} onChange={(e) => updateProduct(index, 'category', e.target.value)}>
                      <option value="laptop">Laptop</option>
                      <option value="printer">Printer</option>
                      <option value="mouse">Mouse</option>
                      <option value="keyboard">Keyboard</option>
                      <option value="monitor">Monitor</option>
                      <option value="wifi_router">WiFi Router</option>
                      <option value="accessories">Accessories</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input type="text" className="form-input" value={product.description} onChange={(e) => updateProduct(index, 'description', e.target.value)} placeholder="Brief description" />
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addProduct} style={{ width: '100%' }}>+ Add Another Product</button>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
            {loading ? 'Submitting...' : 'Register'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
          <a href="/vendor-sla" style={{ color: 'var(--primary)' }}>Back to SLA</a>
        </p>
      </div>
    </div>
  )
}

// ==========================================
// MAIN APPLICATION PAGES
// ==========================================

// Role Permissions Configuration
const ROLE_PERMISSIONS = {
  it_admin: {
    pages: ['dashboard', 'devices', 'vendors', 'requests', 'allocations', 'warranty', 'maintenance', 'sla', 'reports', 'users', 'employee_reports', 'procurement_issues'],
    actions: ['add_device', 'add_vendor', 'create_request', 'allocate', 'warranty_claim', 'maintenance', 'sla', 'reports', 'users', 'delete_user']
  },
  procurement: {
    pages: ['dashboard', 'devices', 'vendors', 'requests', 'allocations', 'sla', 'reports', 'employee_reports', 'procurement_issues'],
    actions: ['add_vendor', 'create_request', 'allocate', 'sla', 'reports']
  },
  vendor: {
    pages: ['dashboard', 'requests', 'devices', 'vendor_issues'],
    actions: ['respond_request', 'submit_device', 'resolve_issue']
  }
}

// Helper to normalize role (for backward compatibility with old super_admin)
function normalizeRole(role) {
  if (role === 'super_admin') return 'it_admin'
  return role
}

function canAccessPage(user, pageId) {
  if (!user || !user.role) return false
  const normalizedRole = normalizeRole(user.role)
  const permissions = ROLE_PERMISSIONS[normalizedRole]
  if (!permissions) return false
  return permissions.pages.includes(pageId)
}

// Sidebar
function Sidebar({ activePage, setActivePage, user, onLogout }) {
  const allNavItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
    { id: 'devices', icon: Laptop, label: 'Devices' },
    { id: 'vendors', icon: Truck, label: 'Vendors' },
    { id: 'requests', icon: ClipboardList, label: 'Purchase Requests' },
    { id: 'allocations', icon: Users, label: 'Allocations' },
    { id: 'warranty', icon: Shield, label: 'Warranty Claims' },
    { id: 'maintenance', icon: Wrench, label: 'Maintenance' },
    { id: 'sla', icon: FileText, label: 'SLA Agreements' },
    { id: 'reports', icon: Package, label: 'Reports' },
    { id: 'employee_reports', icon: AlertTriangle, label: 'Issue Reports' },
    { id: 'procurement_issues', icon: CheckCircle, label: 'Verify Issues' },
    { id: 'users', icon: Settings, label: 'Users' },
    { id: 'vendor_issues', icon: AlertTriangle, label: 'My Issues' },
  ]

  const navItems = allNavItems.filter(item => canAccessPage(user, item.id))

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>D03 AMS</h1>
        <span>D03 AMS</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <div key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`} onClick={() => setActivePage(item.id)}>
            <item.icon size={20} />
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
      <div style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div className="user-avatar">{user?.name?.charAt(0)}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{user?.name}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={onLogout}>
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  )
}

// Dashboard
function Dashboard({ user }) {
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const isVendor = normalizeRole(user?.role) === 'vendor'
  const isProcurement = normalizeRole(user?.role) === 'procurement' || normalizeRole(user?.role) === 'it_admin'

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      let endpoint = '/dashboard/stats'
      if (isVendor) {
        endpoint = '/vendor/dashboard/stats'
      }
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  if (loading) return <div>Loading...</div>

  // Vendor Dashboard
  if (isVendor) {
    return (
      <div>
        <h3 style={{ marginBottom: 24 }}>Vendor Dashboard</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon orange"><ClipboardList size={28} /></div>
            <div>
              <div className="stat-value">{stats.pendingRequests}</div>
              <div className="stat-label">Pending Requests</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><CheckCircle size={28} /></div>
            <div>
              <div className="stat-value">{stats.acceptedRequests}</div>
              <div className="stat-label">Accepted Requests</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Package size={28} /></div>
            <div>
              <div className="stat-value">{stats.deliveredDevices}</div>
              <div className="stat-label">Delivered Devices</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Procurement/Admin Dashboard
  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Laptop size={28} /></div>
          <div>
            <div className="stat-value">{stats.totalDevices}</div>
            <div className="stat-label">Total Devices</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Package size={28} /></div>
          <div>
            <div className="stat-value">{stats.availableDevices}</div>
            <div className="stat-label">Available</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Users size={28} /></div>
          <div>
            <div className="stat-value">{stats.allocatedDevices}</div>
            <div className="stat-label">Allocated</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Shield size={28} /></div>
          <div>
            <div className="stat-value">{stats.underWarranty}</div>
            <div className="stat-label">Under Warranty</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Wrench size={28} /></div>
          <div>
            <div className="stat-value">{stats.dueMaintenance}</div>
            <div className="stat-label">In Maintenance</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Truck size={28} /></div>
          <div>
            <div className="stat-value">{stats.totalVendors}</div>
            <div className="stat-label">Active Vendors</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {isProcurement && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Actions</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('openModal', { detail: 'device' }))}>
                <Package size={18} /> Add New Device
              </button>
              <button className="btn btn-secondary" onClick={() => window.dispatchEvent(new CustomEvent('openModal', { detail: 'vendor' }))}>
                <Truck size={18} /> Add New Vendor
              </button>
              <button className="btn btn-secondary" onClick={() => window.dispatchEvent(new CustomEvent('openModal', { detail: 'request' }))}>
                <ClipboardList size={18} /> Create Purchase Request
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Pending Requests</h3>
          </div>
          <div style={{ padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500 }}>Pending Approvals</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Awaiting vendor response</div>
              </div>
              <span className="badge badge-warning">{stats.pendingRequests}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Devices Page
function DevicesPage({ globalModal, setGlobalModal }) {
  const [devices, setDevices] = useState([])
  const [vendors, setVendors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingDevice, setEditingDevice] = useState(null)
  const [formData, setFormData] = useState({ serial_number: '', model: '', brand: '', ram_gb: '', storage_gb: '', processor: '', purchase_date: '', vendor_id: '', warranty_months: 3 })
  const [qrCode, setQrCode] = useState(null)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    loadDevices()
    loadVendors()
  }, [])

  useEffect(() => {
    if (globalModal === 'device') {
      setShowModal(true)
      setEditingDevice(null)
      setFormData({ serial_number: '', model: '', brand: '', ram_gb: '', storage_gb: '', processor: '', purchase_date: '', vendor_id: '', warranty_months: 3 })
      setGlobalModal(null)
    }
  }, [globalModal, setGlobalModal])

  const loadDevices = async () => {
    let endpoint = '/devices'
    if (normalizeRole(user.role) === 'vendor') {
      endpoint = '/vendor/devices'
    }
    const data = await fetchAPI(endpoint)
    setDevices(data)
  }

  const loadVendors = async () => {
    const data = await fetchAPI('/vendors')
    setVendors(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingDevice) {
        await fetchAPI(`/devices/${editingDevice.id}`, { method: 'PUT', body: JSON.stringify(formData) })
      } else {
        const result = await fetchAPI('/devices', { method: 'POST', body: JSON.stringify(formData) })
        if (result.device?.qr_code) setQrCode(result.device.qr_code)
      }
      setShowModal(false)
      setEditingDevice(null)
      setFormData({ serial_number: '', model: '', brand: '', ram_gb: '', storage_gb: '', processor: '', purchase_date: '', vendor_id: '', warranty_months: 3 })
      loadDevices()
    } catch (err) {
      alert(err.message)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingDevice(null)
    setQrCode(null)
  }

  const handleEdit = (device) => {
    setEditingDevice(device)
    setFormData({ ...device, warranty_months: 3 })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this device?')) {
      await fetchAPI(`/devices/${id}`, { method: 'DELETE' })
      loadDevices()
    }
  }

  const handleConfirmDelivery = async (id) => {
    if (confirm('Confirm that this device has been delivered and is in good condition?')) {
      try {
        await fetchAPI(`/devices/${id}/confirm-delivery`, { method: 'PUT' })
        alert('Delivery confirmed successfully!')
        loadDevices()
      } catch (err) {
        alert(err.message)
      }
    }
  }

  const getStatusBadge = (status) => {
    const badges = { available: 'badge-success', allocated: 'badge-info', maintenance: 'badge-warning', retired: 'badge-default', pending: 'badge-warning', delivered: 'badge-success', pending_delivery_confirm: 'badge-warning' }
    return <span className={`badge ${badges[status]}`}>{status.replace(/_/g, ' ')}</span>
  }

  const getConditionBadge = (condition) => {
    const badges = { new: 'badge-success', good: 'badge-info', fair: 'badge-warning', damaged: 'badge-danger' }
    return <span className={`badge ${badges[condition]}`}>{condition}</span>
  }

  return (
    <div>
      <div className="toolbar">
        <h3>Device Management</h3>
        {normalizeRole(user.role) !== 'vendor' && (
          <button className="btn btn-primary" onClick={() => { setEditingDevice(null); setFormData({ serial_number: '', model: '', brand: '', ram_gb: '', storage_gb: '', processor: '', purchase_date: '', vendor_id: '', warranty_months: 3 }); setShowModal(true) }}>
            <Package size={18} /> Add Device
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Asset Tag</th>
                <th>Serial Number</th>
                <th>Model</th>
                <th>Brand</th>
                <th>RAM</th>
                <th>Storage</th>
                <th>Status</th>
                <th>Condition</th>
                {normalizeRole(user.role) !== 'vendor' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr><td colSpan={normalizeRole(user.role) !== 'vendor' ? 10 : 9} className="empty-state">No devices found</td></tr>
              ) : devices.map(device => (
                <tr key={device.id}>
                  <td>
                    {device.device_images ? (
                      <img
                        src={device.device_images}
                        alt={device.asset_tag}
                        style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4, border: '1px solid #ccc' }}
                        onClick={() => window.open(device.device_images, '_blank')}
                      />
                    ) : (
                      <span style={{ color: '#999', fontSize: 12 }}>No Image</span>
                    )}
                  </td>
                  <td><strong>{device.asset_tag}</strong></td>
                  <td>{device.serial_number}</td>
                  <td>{device.model}</td>
                  <td>{device.brand}</td>
                  <td>{device.ram_gb} GB</td>
                  <td>{device.storage_gb} GB</td>
                  <td>{getStatusBadge(device.status)}</td>
                  <td>{getConditionBadge(device.condition)}</td>
                  {normalizeRole(user.role) !== 'vendor' && (
                    <td>
                      <div className="actions">
                        {device.status === 'pending_delivery_confirm' && (
                          <button className="btn btn-sm btn-success" onClick={() => handleConfirmDelivery(device.id)}>Confirm Delivery</button>
                        )}
                        <button className="btn-icon" onClick={() => handleEdit(device)}>Edit</button>
                        <button className="btn-icon" onClick={() => handleDelete(device.id)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingDevice ? 'Edit Device' : 'Add New Device'}</h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Serial Number</label>
                    <input className="form-input" value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Brand</label>
                    <input className="form-input" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input className="form-input" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">RAM (GB)</label>
                    <input type="number" className="form-input" value={formData.ram_gb} onChange={e => setFormData({...formData, ram_gb: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Storage (GB)</label>
                    <input type="number" className="form-input" value={formData.storage_gb} onChange={e => setFormData({...formData, storage_gb: e.target.value})} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Processor</label>
                  <input className="form-input" value={formData.processor} onChange={e => setFormData({...formData, processor: e.target.value})} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input type="date" className="form-input" value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Warranty (Months)</label>
                    <input type="number" className="form-input" value={formData.warranty_months} onChange={e => setFormData({...formData, warranty_months: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <select className="form-select" value={formData.vendor_id} onChange={e => setFormData({...formData, vendor_id: e.target.value})}>
                    <option value="">Select Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                {qrCode && (
                  <div className="qr-display">
                    <p>QR Code Generated</p>
                    <img src={qrCode} alt="QR Code" />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingDevice ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Vendors Page
function VendorsPage({ globalModal, setGlobalModal }) {
  const [vendors, setVendors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingVendor, setEditingVendor] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', status: 'pending', rating: 0 })
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdmin = normalizeRole(user.role) === 'it_admin'

  useEffect(() => {
    loadVendors()
    const interval = setInterval(loadVendors, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (globalModal === 'vendor') {
      setShowModal(true)
      setEditingVendor(null)
      setFormData({ name: '', email: '', phone: '', address: '', status: 'pending', rating: 0 })
      setGlobalModal(null)
    }
  }, [globalModal, setGlobalModal])

  const closeModal = () => {
    setShowModal(false)
    setEditingVendor(null)
    setFormData({ name: '', email: '', phone: '', address: '', status: 'pending', rating: 0 })
  }

  const loadVendors = async () => {
    const data = await fetchAPI('/vendors')
    setVendors(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingVendor) {
        await fetchAPI(`/vendors/${editingVendor.id}`, { method: 'PUT', body: JSON.stringify(formData) })
      } else {
        await fetchAPI('/vendors', { method: 'POST', body: JSON.stringify(formData) })
      }
      setShowModal(false)
      setEditingVendor(null)
      setFormData({ name: '', email: '', phone: '', address: '', status: 'pending', rating: 0 })
      loadVendors()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleEdit = (vendor) => {
    setEditingVendor(vendor)
    setFormData({ ...vendor })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this vendor?')) {
      await fetchAPI(`/vendors/${id}`, { method: 'DELETE' })
      loadVendors()
    }
  }

  const getStatusBadge = (status) => {
    const badges = { active: 'badge-success', inactive: 'badge-default', pending: 'badge-warning', pending_sla: 'badge-warning', pending_registration: 'badge-warning', sla_agreed: 'badge-info', rejected: 'badge-danger' }
    return <span className={`badge ${badges[status]}`}>{status.replace('_', ' ')}</span>
  }

  const renderStars = (rating) => {
    return '★'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0))
  }

  return (
    <div>
      <div className="toolbar">
        <h3>Vendor Management</h3>
        <button className="btn btn-primary" onClick={() => { setEditingVendor(null); setFormData({ name: '', email: '', phone: '', address: '', status: 'pending', rating: 0 }); setShowModal(true) }}>
          <Truck size={18} /> Add Vendor
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Rating</th>
                <th>On-Time %</th>
                <th>Quality</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No vendors found</td></tr>
              ) : vendors.map(vendor => (
                <tr key={vendor.id}>
                  <td><strong>{vendor.name}</strong></td>
                  <td>{vendor.email}</td>
                  <td>{vendor.phone}</td>
                  <td style={{ color: '#F7931E' }}>{renderStars(vendor.rating)}</td>
                  <td>{vendor.on_time_delivery}%</td>
                  <td>{vendor.quality_score}%</td>
                  <td>{getStatusBadge(vendor.status)}</td>
                  <td>
                    <div className="actions">
                      <button className="btn-icon" onClick={() => handleEdit(vendor)}>Edit</button>
                      {isAdmin && <button className="btn-icon" onClick={() => handleDelete(vendor.id)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Vendor Name</label>
                  <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea className="form-textarea" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                {editingVendor && (
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Rating (1-5)</label>
                      <input type="number" min="1" max="5" className="form-input" value={formData.rating} onChange={e => setFormData({...formData, rating: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingVendor ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Purchase Requests Page (for Procurement/Admin)
function RequestsPage({ globalModal, setGlobalModal }) {
  const [requests, setRequests] = useState([])
  const [vendors, setVendors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ vendor_id: '', product_name: '', specifications: '', ram_specs: '', processor_specs: '', quantity: 1, notes: '' })
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isVendor = normalizeRole(user.role) === 'vendor'
  const isAdmin = normalizeRole(user.role) === 'it_admin'
  const currentVendorId = user.vendor_id || null

  // If vendor_id is not in user data, try to get it from vendors table
  useEffect(() => {
    if (isVendor && !currentVendorId) {
      loadVendors().then(() => {
        // Find vendor by matching email
        const matchedVendor = vendors.find(v => v.email === user.email)
        if (matchedVendor) {
          const updatedUser = { ...user, vendor_id: matchedVendor.id }
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }
      })
    }
  }, [isVendor, currentVendorId])

  useEffect(() => {
    loadRequests()
    loadVendors()
    const interval = setInterval(() => {
      loadRequests()
      loadVendors()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (globalModal === 'request') {
      setShowModal(true)
      setFormData({ vendor_id: '', product_name: '', specifications: '', ram_specs: '', processor_specs: '', quantity: 1, notes: '' })
      setGlobalModal(null)
    }
  }, [globalModal, setGlobalModal])

  const closeModal = () => {
    setShowModal(false)
    setFormData({ vendor_id: '', product_name: '', specifications: '', ram_specs: '', processor_specs: '', quantity: 1, notes: '' })
  }

  const loadRequests = async () => {
    let endpoint = isVendor ? '/vendor/requests' : '/procurement/requests'
    const data = await fetchAPI(endpoint)
    setRequests(data)
  }

  const loadVendors = async () => {
    const data = await fetchAPI('/vendors')
    setVendors(data.filter(v => v.status === 'active' || v.status === 'pending_registration'))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (isVendor) {
        alert('Vendors cannot create requests')
        return
      }
      await fetchAPI('/procurement/requests', { method: 'POST', body: JSON.stringify(formData) })
      setShowModal(false)
      setFormData({ vendor_id: '', product_name: '', specifications: '', ram_specs: '', processor_specs: '', quantity: 1, notes: '' })
      loadRequests()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleStatusUpdate = async (id, status, notes = '') => {
    await fetchAPI(`/requests/${id}`, { method: 'PUT', body: JSON.stringify({ status, notes }) })
    loadRequests()
  }

  const handleDeleteRequest = async (id) => {
    if (!confirm('Are you sure you want to delete this purchase request?')) return
    try {
      await fetchAPI(`/requests/${id}`, { method: 'DELETE' })
      loadRequests()
      alert('Request deleted successfully')
    } catch (err) {
      alert('Failed to delete request: ' + err.message)
    }
  }

  // Vendor response handlers
  const handleVendorResponse = async (id, response, notes = '') => {
    await fetchAPI(`/vendor/requests/${id}/respond`, { method: 'PUT', body: JSON.stringify({ response, vendor_notes: notes }) })
    loadRequests()
  }

  const [deviceForm, setDeviceForm] = useState(null)
  const [deviceData, setDeviceData] = useState({ serial_number: '', model: '', brand: '', ram_gb: '', storage_gb: '', processor: '', condition: 'new', expected_delivery_date: '', device_images: '' })
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [reassignModal, setReassignModal] = useState(null)
  const [reassignVendorId, setReassignVendorId] = useState('')

  const handleReassign = async () => {
    if (!reassignVendorId) {
      alert('Please select a vendor')
      return
    }
    const requestId = reassignModal
    console.log('Starting reassign:', { requestId, vendorId: reassignVendorId })
    try {
      const token = localStorage.getItem('token')
      console.log('Token exists:', !!token)
      console.log('API URL:', `${API_URL}/requests/${requestId}`)
      const response = await fetch(`${API_URL}/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ vendor_id: reassignVendorId, status: 'pending' })
      })
      console.log('Response status:', response.status)
      const data = await response.text()
      console.log('Response data:', data)
      if (!response.ok) {
        throw new Error(data || `Error ${response.status}`)
      }
      setReassignModal(null)
      setReassignVendorId('')
      loadRequests()
      alert('Vendor reassigned successfully')
    } catch (err) {
      console.error('Reassign error:', err, JSON.stringify(err))
      const errorMsg = err.message || err.toString() || JSON.stringify(err) || 'Unknown error'
      alert('Failed to reassign vendor: ' + errorMsg)
    }
  }

  const handleAcceptClick = (id) => {
    setDeviceForm(id)
  }

  const handleRejectClick = (id) => {
    setRejectModal(id)
    setRejectReason('')
  }

  const handleRejectSubmit = async (id) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    try {
      await fetchAPI(`/vendor/requests/${id}/respond`, { method: 'PUT', body: JSON.stringify({ response: 'rejected', vendor_notes: rejectReason }) })
      setRejectModal(null)
      setRejectReason('')
      loadRequests()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setDeviceData({ ...deviceData, device_images: reader.result })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDeviceSubmit = async (e) => {
    e.preventDefault()
    try {
      await fetchAPI('/vendor/devices', { method: 'POST', body: JSON.stringify({ request_id: deviceForm, ...deviceData }) })
      // Find the request to check how many devices have been submitted
      const currentRequest = requests.find(r => r.id === deviceForm)
      const newCount = (currentRequest?.devices_submitted || 0) + 1
      const remaining = currentRequest?.quantity - newCount

      // Only update request status to pending_confirmation when all devices are submitted (procurement needs to confirm delivery)
      if (currentRequest && newCount >= currentRequest.quantity) {
        await fetchAPI(`/requests/${deviceForm}`, { method: 'PUT', body: JSON.stringify({ status: 'pending_delivery_confirmation' }) })
        setDeviceForm(null)
        setDeviceData({ serial_number: '', model: '', brand: '', ram_gb: '', storage_gb: '', processor: '', condition: 'new', expected_delivery_date: '', device_images: '' })
        alert('All devices submitted successfully! Waiting for procurement to confirm delivery.')
      } else {
        // Keep modal open to submit remaining devices
        alert(`Device submitted! ${remaining} more device(s) remaining for this request.`)
        setDeviceData({ serial_number: '', model: '', brand: '', ram_gb: '', storage_gb: '', processor: '', condition: 'new', expected_delivery_date: '', device_images: '' })
      }
      loadRequests()
    } catch (err) {
      alert(err.message)
    }
  }

  const getStatusBadge = (status) => {
    const badges = { pending: 'badge-warning', vendor_notified: 'badge-info', accepted: 'badge-success', rejected: 'badge-danger', delivered: 'badge-success', pending_delivery_confirmation: 'badge-warning', cancelled: 'badge-default' }
    return <span className={`badge ${badges[status]}`}>{status.replace(/_/g, ' ')}</span>
  }

  return (
    <div>
      <div className="toolbar">
        <h3>{isVendor ? 'My Requests' : 'Purchase Requests'}</h3>
        {!isVendor && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <ClipboardList size={18} /> New Request
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Request #</th>
                {!isVendor && <th>Vendor</th>}
                <th>Product</th>
                <th>Specs</th>
                <th>Qty/Delivered</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No requests found</td></tr>
              ) : requests.map(req => (
                <tr key={req.id}>
                  <td><strong>{req.request_number}</strong></td>
                  {!isVendor && <td>{req.vendor_name}</td>}
                  <td>{req.product_name}</td>
                  <td>{req.specifications}</td>
                  <td>{req.devices_submitted || 0}/{req.quantity}</td>
                  <td>{getStatusBadge(req.status)}</td>
                  <td>{new Date(req.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="actions">
                      {isVendor && (req.status === 'pending' || req.status === 'vendor_notified') && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => handleAcceptClick(req.id)}>Accept</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleRejectClick(req.id)}>Reject</button>
                        </>
                      )}
                      {isVendor && req.vendor_id === currentVendorId && req.status === 'accepted' && (req.devices_submitted < req.quantity) && (
                        <button className="btn btn-sm btn-success" onClick={() => setDeviceForm(req.id)}>Submit Device ({req.quantity - (req.devices_submitted || 0)} remaining)</button>
                      )}
                      {isVendor && req.vendor_id === currentVendorId && req.status === 'accepted' && (req.devices_submitted >= req.quantity) && (
                        <span className="badge badge-success">Completed ({req.devices_submitted}/{req.quantity})</span>
                      )}
                      {!isVendor && req.status === 'pending' && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleStatusUpdate(req.id, 'cancelled')}>Cancel</button>
                      )}
                      {!isVendor && (req.status === 'rejected' || req.status === 'declined') && (
                        <button className="btn btn-sm btn-warning" onClick={() => { console.log('Reassign clicked for:', req.id); setReassignModal(req.id); setReassignVendorId('') }}>Reassign Vendor</button>
                      )}
                      {isAdmin && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRequest(req.id)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Request Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Purchase Request</h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Vendor *</label>
                  <select className="form-select" value={formData.vendor_id} onChange={e => setFormData({...formData, vendor_id: e.target.value})} required>
                    <option value="">Select Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Product Name (Optional)</label>
                  <input className="form-input" value={formData.product_name} onChange={e => setFormData({...formData, product_name: e.target.value})} placeholder="e.g., Dell Laptop" />
                </div>
                <div className="form-group">
                  <label className="form-label">Specifications (Optional)</label>
                  <textarea className="form-textarea" value={formData.specifications} onChange={e => setFormData({...formData, specifications: e.target.value})} placeholder="General specifications" />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">RAM (Optional)</label>
                    <input className="form-input" value={formData.ram_specs} onChange={e => setFormData({...formData, ram_specs: e.target.value})} placeholder="e.g., 16GB" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Processor (Optional)</label>
                    <input className="form-input" value={formData.processor_specs} onChange={e => setFormData({...formData, processor_specs: e.target.value})} placeholder="e.g., Intel i7" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input type="number" className="form-input" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} min="1" defaultValue={1} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <textarea className="form-textarea" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vendor Device Form Modal */}
      {deviceForm && (
        <div className="modal-overlay" onClick={() => setDeviceForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submit Device Details</h3>
              <button className="modal-close" onClick={() => setDeviceForm(null)}>&times;</button>
            </div>
            <form onSubmit={handleDeviceSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Serial Number *</label>
                    <input className="form-input" value={deviceData.serial_number} onChange={e => setDeviceData({...deviceData, serial_number: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Brand *</label>
                    <input className="form-input" value={deviceData.brand} onChange={e => setDeviceData({...deviceData, brand: e.target.value})} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Model *</label>
                  <input className="form-input" value={deviceData.model} onChange={e => setDeviceData({...deviceData, model: e.target.value})} required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">RAM (GB)</label>
                    <input type="number" className="form-input" value={deviceData.ram_gb} onChange={e => setDeviceData({...deviceData, ram_gb: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Storage (GB)</label>
                    <input type="number" className="form-input" value={deviceData.storage_gb} onChange={e => setDeviceData({...deviceData, storage_gb: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Processor</label>
                  <input className="form-input" value={deviceData.processor} onChange={e => setDeviceData({...deviceData, processor: e.target.value})} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Condition</label>
                    <select className="form-select" value={deviceData.condition} onChange={e => setDeviceData({...deviceData, condition: e.target.value})}>
                      <option value="new">New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expected Delivery Date</label>
                    <input type="date" className="form-input" value={deviceData.expected_delivery_date} onChange={e => setDeviceData({...deviceData, expected_delivery_date: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Device Photos (Optional)</label>
                  <input type="file" accept="image/*" className="form-input" onChange={handleImageUpload} style={{ padding: 8 }} />
                  {deviceData.device_images && (
                    <img src={deviceData.device_images} alt="Device" style={{ maxWidth: 150, maxHeight: 100, marginTop: 8, border: '1px solid #ccc', padding: 5 }} />
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDeviceForm(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Device</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reject Purchase Request</h3>
              <button className="modal-close" onClick={() => setRejectModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Reason for Rejection *</label>
                <textarea className="form-textarea" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Please provide a reason for rejecting this request" required />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setRejectModal(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => handleRejectSubmit(rejectModal)}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Vendor Modal */}
      {reassignModal && (
        <div className="modal-overlay" onClick={() => setReassignModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reassign Vendor</h3>
              <button className="modal-close" onClick={() => setReassignModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Select New Vendor *</label>
                <select className="form-select" value={reassignVendorId} onChange={e => setReassignVendorId(e.target.value)}>
                  <option value="">Select Vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setReassignModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleReassign}>Reassign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Allocations Page
function AllocationsPage() {
  const [allocations, setAllocations] = useState([])
  const [devices, setDevices] = useState([])
  const [employees, setEmployees] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingAllocation, setEditingAllocation] = useState(null)
  const [reassignModal, setReassignModal] = useState(null)
  const [reassignData, setReassignData] = useState({ employee_name: '', employee_email: '', employee_id: '', department: '', job_title: '', work_email: '' })
  const [formData, setFormData] = useState({ device_id: '', employee_name: '', employee_email: '', employee_id: '', department: '', job_title: '', work_email: '', issue_date: new Date().toISOString().split('T')[0], issue_condition: 'new' })
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdmin = normalizeRole(user.role) === 'it_admin'

  useEffect(() => {
    loadAllocations()
    loadDevices()
    loadEmployees()
  }, [])

  const loadAllocations = async () => {
    const data = await fetchAPI('/allocations')
    setAllocations(data)
  }

  const loadDevices = async () => {
    const data = await fetchAPI('/devices')
    // Only show available devices for new allocations (not allocated, not maintenance, not retired)
    setDevices(data.filter(d => d.status === 'available' || d.status === 'delivered'))
  }

  const loadEmployees = async () => {
    const data = await fetchAPI('/employees')
    setEmployees(data)
  }

  const handleReassignClick = (alloc) => {
    setReassignModal(alloc.id)
    setReassignData({
      employee_name: alloc.employee_name || '',
      employee_email: alloc.employee_email || '',
      employee_id: alloc.employee_id || '',
      department: alloc.department || '',
      job_title: alloc.job_title || '',
      work_email: alloc.work_email || ''
    })
  }

  const handleReassignSubmit = async (id) => {
    try {
      const allocation = allocations.find(a => a.id === id)
      // Send all employee details in one call so email can be sent
      await fetchAPI(`/allocations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          device_id: allocation.device_id,
          employee_id: reassignData.employee_id,
          employee_name: reassignData.employee_name,
          employee_email: reassignData.employee_email,
          work_email: reassignData.work_email,
          department: reassignData.department,
          job_title: reassignData.job_title,
          issue_date: allocation.issue_date,
          issue_condition: allocation.issue_condition,
          status: 'active'
        })
      })
      setReassignModal(null)
      setReassignData({ employee_name: '', employee_email: '', employee_id: '', department: '', job_title: '', work_email: '' })
      loadAllocations()
      alert('Device reassigned successfully! The new employee has been notified via email.')
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate work_email is provided
    if (!formData.work_email && !formData.employee_email) {
      alert('Please provide a Work Email address for the employee')
      return
    }

    console.log('Submitting allocation form:', JSON.stringify(formData))
    try {
      if (editingAllocation) {
        const updateData = {
          ...formData,
          // Ensure we have a valid employee_id (use 'unknown' if not available)
          employee_id: formData.employee_id || 'unknown'
        }
        console.log('Sending PUT with data:', JSON.stringify(updateData))
        const result = await fetchAPI(`/allocations/${editingAllocation.id}`, { method: 'PUT', body: JSON.stringify(updateData) })
        console.log('Update result:', result)
        alert('Allocation updated successfully!')
      } else {
        await fetchAPI('/procurement/allocations', { method: 'POST', body: JSON.stringify(formData) })
        alert('Device allocated successfully!')
      }
      setShowModal(false)
      setEditingAllocation(null)
      setFormData({ device_id: '', employee_name: '', employee_email: '', employee_id: '', department: '', job_title: '', work_email: '', issue_date: new Date().toISOString().split('T')[0], issue_condition: 'new' })
      loadAllocations()
      loadDevices()
    } catch (err) {
      console.error('Allocation submit error:', err)
      alert('Error: ' + err.message)
    }
  }

  const handleEditAllocation = (alloc) => {
    setEditingAllocation(alloc)
    setFormData({
      device_id: alloc.device_id || '',
      employee_name: alloc.employee_name || '',
      employee_email: alloc.employee_email || '',
      employee_id: alloc.employee_id || '',
      department: alloc.department || '',
      job_title: alloc.job_title || '',
      work_email: alloc.work_email || '',
      issue_date: alloc.issue_date || '',
      issue_condition: alloc.issue_condition || 'new'
    })
    setShowModal(true)
  }

  const handleDeleteAllocation = async (id) => {
    if (confirm('Are you sure you want to delete this allocation?')) {
      try {
        await fetchAPI(`/allocations/${id}`, { method: 'DELETE' })
        loadAllocations()
        loadDevices()
      } catch (err) {
        alert(err.message)
      }
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h3>Device Allocations</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Users size={18} /> Allocate Device
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Device</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Issue Date</th>
                <th>Issue Condition</th>
                <th>Employee Report</th>
                <th>Report Date</th>
                <th>Return Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr><td colSpan={11} className="empty-state">No allocations found</td></tr>
              ) : allocations.map(alloc => (
                <tr key={alloc.id}>
                  <td><strong>{alloc.asset_tag}</strong></td>
                  <td>{alloc.model}</td>
                  <td>{alloc.employee_name || 'Unknown (deleted)'}</td>
                  <td>{alloc.department || '-'}</td>
                  <td>{alloc.issue_date}</td>
                  <td>
                    <span className={`badge ${
                      alloc.issue_condition === 'good' ? 'badge-success' :
                      alloc.issue_condition === 'fair' ? 'badge-warning' :
                      alloc.issue_condition === 'poor' || alloc.issue_condition === 'damaged' ? 'badge-danger' :
                      'badge-default'
                    }`}>
                      {alloc.issue_condition || 'Not reported'}
                    </span>
                  </td>
                  <td>{alloc.issue_report || '-'}</td>
                  <td>{alloc.report_submitted_at ? new Date(alloc.report_submitted_at).toLocaleDateString() : '-'}</td>
                  <td>{alloc.return_date || '-'}</td>
                  <td><span className={`badge ${alloc.status === 'active' ? 'badge-success' : 'badge-default'}`}>{alloc.status}</span></td>
                  <td>
                    <div className="actions">
                      <button className="btn-icon" onClick={() => handleEditAllocation(alloc)}>Edit</button>
                      {isAdmin && <button className="btn-icon" onClick={() => handleDeleteAllocation(alloc.id)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAllocation ? 'Edit Allocation' : 'Allocate Device to Employee'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Device *</label>
                  <select className="form-select" value={formData.device_id} onChange={e => setFormData({...formData, device_id: e.target.value})} required disabled={!!editingAllocation}>
                    <option value="">Select Device</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.asset_tag} - {d.model}</option>)}
                  </select>
                </div>
                {editingAllocation && (
                  <div className="form-group">
                    <label className="form-label">Reallocate to Employee (select existing)</label>
                    <select className="form-select" value={formData.employee_id} onChange={e => {
                      const emp = employees.find(em => em.id === e.target.value)
                      if (emp) {
                        setFormData({
                          ...formData,
                          employee_id: emp.id,
                          employee_name: emp.name,
                          employee_email: emp.email || '',
                          department: emp.department || '',
                          job_title: emp.job_title || '',
                          work_email: emp.work_email || emp.email || ''
                        })
                      }
                    }}>
                      <option value="">Select Employee (optional)</option>
                      {employees.filter(e => e.status === 'active').map(e => (
                        <option key={e.id} value={e.id}>{e.name} - {e.department}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Employee Name *</label>
                    <input className="form-input" value={formData.employee_name} onChange={e => setFormData({...formData, employee_name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employee ID</label>
                    <input className="form-input" value={formData.employee_id} onChange={e => setFormData({...formData, employee_id: e.target.value})} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <input className="form-input" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Job Title</label>
                    <input className="form-input" value={formData.job_title} onChange={e => setFormData({...formData, job_title: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Work Email *</label>
                  <input type="email" className="form-input" value={formData.work_email} onChange={e => setFormData({...formData, work_email: e.target.value})} required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Issue Date</label>
                    <input type="date" className="form-input" value={formData.issue_date} onChange={e => setFormData({...formData, issue_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Condition</label>
                    <select className="form-select" value={formData.issue_condition} onChange={e => setFormData({...formData, issue_condition: e.target.value})}>
                      <option value="new">New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingAllocation ? 'Update' : 'Allocate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Employee Reports Page
function EmployeeReportsPage() {
  const [reports, setReports] = useState([])
  const [devices, setDevices] = useState([])
  const [vendors, setVendors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)
  const [formData, setFormData] = useState({ device_id: '', report_type: 'other', description: '' })
  const [vendorFormData, setVendorFormData] = useState({ vendor_id: '', notes: '' })
  const [returnModal, setReturnModal] = useState(null)
  const [returnNotes, setReturnNotes] = useState('')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isEmployee = normalizeRole(user.role) === 'employee'
  const isVendor = normalizeRole(user.role) === 'vendor'
  const isProcurement = normalizeRole(user.role) === 'procurement' || normalizeRole(user.role) === 'it_admin'
  const isAdmin = normalizeRole(user.role) === 'it_admin'

  useEffect(() => {
    loadReports()
    loadDevices()
    loadVendors()
  }, [])

  const loadReports = async () => {
    let endpoint = isEmployee ? '/employee/reports' : '/procurement/reports'
    const data = await fetchAPI(endpoint)
    setReports(data)
  }

  const loadDevices = async () => {
    const data = await fetchAPI('/devices')
    setDevices(data)
  }

  const loadVendors = async () => {
    try {
      const data = await fetchAPI('/vendors')
      setVendors(data.filter(v => v.status === 'active'))
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await fetchAPI('/employee/reports', { method: 'POST', body: JSON.stringify(formData) })
      setShowModal(false)
      setFormData({ device_id: '', report_type: 'other', description: '' })
      loadReports()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleResolve = async (id, resolution, notes = '') => {
    await fetchAPI(`/procurement/reports/${id}/resolve`, { method: 'PUT', body: JSON.stringify({ resolution, resolution_notes: notes }) })
    loadReports()
  }

  const handleSendToVendor = (report) => {
    setSelectedReport(report)
    setShowVendorModal(true)
  }

  const handleSubmitToVendor = async (e) => {
    e.preventDefault()
    try {
      await fetchAPI(`/procurement/reports/${selectedReport.id}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({
          resolution: 'send_to_vendor',
          resolution_notes: vendorFormData.notes,
          vendor_id: vendorFormData.vendor_id
        })
      })
      setShowVendorModal(false)
      setSelectedReport(null)
      setVendorFormData({ vendor_id: '', notes: '' })
      loadReports()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleRepairComplete = async (id) => {
    try {
      await fetchAPI(`/vendor/reports/${id}/repair-complete`, { method: 'PUT' })
      loadReports()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleReturnDevice = async (id) => {
    try {
      await fetchAPI(`/procurement/reports/${id}/return`, {
        method: 'PUT',
        body: JSON.stringify({ return_notes: returnNotes })
      })
      setReturnModal(null)
      setReturnNotes('')
      loadReports()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleConfirmResolution = async (id) => {
    if (confirm('Confirm that the issue has been resolved and the device is ready to be returned to the employee?')) {
      try {
        await fetchAPI(`/procurement/reports/${id}/confirm-resolution`, { method: 'PUT' })
        alert('Issue resolution confirmed!')
        loadReports()
      } catch (err) {
        alert(err.message)
      }
    }
  }

  const handleDeleteReport = async (id) => {
    if (confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      try {
        await fetchAPI(`/procurement/reports/${id}`, { method: 'DELETE' })
        alert('Report deleted successfully!')
        loadReports()
      } catch (err) {
        alert(err.message)
      }
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-warning',
      reviewed: 'badge-info',
      sent_to_vendor: 'badge-primary',
      resolved_internal: 'badge-success',
      resolved_vendor: 'badge-success',
      under_repair: 'badge-warning',
      repair_pending: 'badge-warning',
      repair_completed: 'badge-success',
      repair_pending_confirmation: 'badge-warning',
      awaiting_employee_confirmation: 'badge-info',
      returned: 'badge-success'
    }
    return <span className={`badge ${badges[status]}`}>{status.replace(/_/g, ' ')}</span>
  }

  return (
    <div>
      <div className="toolbar">
        <h3>{isEmployee ? 'My Device Reports' : 'Device Issue Reports'}</h3>
        {isEmployee && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <AlertTriangle size={18} /> Report Issue
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Date</th>
                {isEmployee && <th>Actions</th>}
                {!isEmployee && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan={isEmployee ? 6 : 7} className="empty-state">No reports found</td></tr>
              ) : reports.map(report => (
                <tr key={report.id}>
                  <td><strong>{report.asset_tag}</strong> - {report.model}</td>
                  <td><span className="badge badge-info">{report.report_type}</span></td>
                  <td>{report.description}</td>
                  <td>{getStatusBadge(report.status)}</td>
                  <td>{new Date(report.created_at).toLocaleDateString()}</td>
                  {isEmployee && (
                    <td>
                      <div className="actions">
                        {report.status === 'awaiting_employee_confirmation' && (
                          <button className="btn btn-sm btn-success" onClick={() => window.location.href = `/confirm-device?report_id=${report.id}`}>Confirm Device</button>
                        )}
                        {report.status === 'returned' && (
                          <span className="badge badge-success">Completed</span>
                        )}
                      </div>
                    </td>
                  )}
                  {!isEmployee && (
                    <td>
                      <div className="actions">
                        {report.status === 'pending' && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => handleResolve(report.id, 'resolved_internal', 'Resolved within organization')}>Resolve Internal</button>
                            <button className="btn btn-sm btn-primary" onClick={() => handleSendToVendor(report)}>Send to Vendor</button>
                          </>
                        )}
                        {report.status === 'repair_pending_confirmation' && isProcurement && (
                          <button className="btn btn-sm btn-success" onClick={() => handleConfirmResolution(report.id)}>Confirm Resolution</button>
                        )}
                        {report.status === 'awaiting_employee_confirmation' && isProcurement && (
                          <span className="badge badge-info">Awaiting Employee</span>
                        )}
                        {(report.status === 'sent_to_vendor' || report.status === 'under_repair' || report.status === 'repair_pending' || report.status === 'repair_completed') && isProcurement && (
                          <button className="btn btn-sm btn-success" onClick={() => setReturnModal(report.id)}>Mark Returned</button>
                        )}
                        {isAdmin && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteReport(report.id)}>Delete</button>
                        )}
                      </div>
                    </td>
                  )}
                  {isVendor && (
                    <td>
                      <div className="actions">
                        {(report.status === 'sent_to_vendor' || report.status === 'under_repair' || report.status === 'repair_pending') && (
                          <button className="btn btn-sm btn-success" onClick={() => handleRepairComplete(report.id)}>Repair Complete</button>
                        )}
                        {report.status === 'awaiting_employee_confirmation' && (
                          <span className="badge badge-info">Awaiting Employee</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Report Device Issue</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Device *</label>
                  <select className="form-select" value={formData.device_id} onChange={e => setFormData({...formData, device_id: e.target.value})} required>
                    <option value="">Select Device</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.asset_tag} - {d.model}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Issue Type</label>
                  <select className="form-select" value={formData.report_type} onChange={e => setFormData({...formData, report_type: e.target.value})}>
                    <option value="hardware_issue">Hardware Issue</option>
                    <option value="software_issue">Software Issue</option>
                    <option value="damage">Damage</option>
                    <option value="performance">Performance Issue</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe the issue in detail..." required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Report</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVendorModal && selectedReport && (
        <div className="modal-overlay" onClick={() => setShowVendorModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Send Issue to Vendor</h3>
              <button className="modal-close" onClick={() => setShowVendorModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmitToVendor}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <p><strong>Device:</strong> {selectedReport.asset_tag} - {selectedReport.model}</p>
                  <p><strong>Issue:</strong> {selectedReport.description}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Select Vendor *</label>
                  <select className="form-select" value={vendorFormData.vendor_id} onChange={e => setVendorFormData({...vendorFormData, vendor_id: e.target.value})} required>
                    <option value="">Select Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={vendorFormData.notes} onChange={e => setVendorFormData({...vendorFormData, notes: e.target.value})} placeholder="Additional notes for vendor..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowVendorModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Send to Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Device Modal */}
      {returnModal && (
        <div className="modal-overlay" onClick={() => setReturnModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Mark Device as Returned</h3>
              <button className="modal-close" onClick={() => setReturnModal(null)}>&times;</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleReturnDevice(returnModal) }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Return Notes (Optional)</label>
                  <textarea className="form-textarea" value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Any notes about the returned device..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReturnModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Return</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Procurement Issues Verification Page
function ProcurementIssuesPage() {
  const [issues, setIssues] = useState([])
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [notes, setNotes] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    loadIssues()
  }, [])

  const loadIssues = async () => {
    // Fetch reports that need procurement verification (repair_pending_confirmation status)
    const data = await fetchAPI('/procurement/reports')
    // Filter to show only issues that need verification
    const pendingVerification = data.filter(r => r.status === 'repair_pending_confirmation')
    setIssues(pendingVerification)
  }

  const handleConfirmResolution = async (id) => {
    if (confirm('Confirm that the vendor has resolved this issue? The device will be marked as ready to return to the employee.')) {
      try {
        await fetchAPI(`/procurement/reports/${id}/confirm-resolution`, { method: 'PUT' })
        alert('Issue resolution confirmed! The employee will be notified to confirm device condition.')
        loadIssues()
      } catch (err) {
        alert(err.message)
      }
    }
  }

  const handleRejectResolution = async (id) => {
    if (!notes.trim()) {
      alert('Please provide a reason for rejecting the resolution.')
      return
    }
    try {
      await fetchAPI(`/procurement/reports/${id}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({
          resolution: 'resolution_rejected',
          resolution_notes: notes
        })
      })
      alert('Resolution rejected. The vendor will be notified.')
      setShowRejectModal(false)
      setNotes('')
      setSelectedIssue(null)
      loadIssues()
    } catch (err) {
      alert(err.message)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-warning',
      sent_to_vendor: 'badge-primary',
      under_repair: 'badge-warning',
      repair_pending: 'badge-warning',
      repair_completed: 'badge-success',
      resolved_vendor: 'badge-success',
      repair_pending_confirmation: 'badge-warning',
      awaiting_employee_confirmation: 'badge-info',
      resolution_rejected: 'badge-danger'
    }
    return <span className={`badge ${badges[status]}`}>{status.replace(/_/g, ' ')}</span>
  }

  return (
    <div>
      <div className="toolbar">
        <h3>Verify Vendor Issue Resolutions</h3>
        <span className="badge badge-warning">{issues.length} pending verification</span>
      </div>

      <div className="card">
        <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
          Review and verify issues that vendors have resolved. Confirm to clear from vendor portal.
        </p>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Serial</th>
                <th>Issue Type</th>
                <th>Description</th>
                <th>Vendor Resolution</th>
                <th>Status</th>
                <th>Date Reported</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No issues pending verification</td></tr>
              ) : issues.map(issue => (
                <tr key={issue.id}>
                  <td><strong>{issue.asset_tag}</strong> - {issue.model}</td>
                  <td>{issue.serial_number}</td>
                  <td><span className="badge badge-info">{issue.report_type}</span></td>
                  <td>{issue.description}</td>
                  <td>
                    <div style={{ maxWidth: 200 }}>
                      <p><strong>Status:</strong> {issue.resolution_status || 'N/A'}</p>
                      <p><strong>Notes:</strong> {issue.resolution_notes || 'No notes'}</p>
                      {issue.expected_return_date && <p><strong>Expected Return:</strong> {issue.expected_return_date}</p>}
                    </div>
                  </td>
                  <td>{getStatusBadge(issue.status)}</td>
                  <td>{new Date(issue.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-sm btn-success" onClick={() => handleConfirmResolution(issue.id)}>
                        Confirm Resolution
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => { setSelectedIssue(issue); setShowRejectModal(true) }}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showRejectModal && selectedIssue && (
        <div className="modal-overlay" onClick={() => { setShowRejectModal(false); setNotes(''); setSelectedIssue(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reject Vendor Resolution</h3>
              <button className="modal-close" onClick={() => { setShowRejectModal(false); setNotes(''); setSelectedIssue(null) }}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <p><strong>Device:</strong> {selectedIssue.asset_tag} - {selectedIssue.model}</p>
                <p><strong>Serial:</strong> {selectedIssue.serial_number}</p>
                <p><strong>Original Issue:</strong> {selectedIssue.description}</p>
                <p><strong>Vendor Resolution:</strong> {selectedIssue.resolution_status}</p>
                {selectedIssue.resolution_notes && <p><strong>Vendor Notes:</strong> {selectedIssue.resolution_notes}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Rejection *</label>
                <textarea
                  className="form-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain why the resolution is being rejected and what needs to be done..."
                  rows={4}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowRejectModal(false); setNotes(''); setSelectedIssue(null) }}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => handleRejectResolution(selectedIssue.id)}>Reject Resolution</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Vendor Issues Page
function VendorIssuesPage() {
  const [issues, setIssues] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [formData, setFormData] = useState({ resolution_notes: '', expected_return_date: '', resolution_status: 'resolved_vendor' })

  useEffect(() => {
    loadIssues()
  }, [])

  const loadIssues = async () => {
    const data = await fetchAPI('/vendor/issues')
    setIssues(data)
  }

  const handleResolve = (issue) => {
    setSelectedIssue(issue)
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await fetchAPI(`/vendor/issues/${selectedIssue.id}/resolve`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      })
      setShowModal(false)
      setSelectedIssue(null)
      setFormData({ resolution_notes: '', expected_return_date: '', resolution_status: 'resolved_vendor' })
      loadIssues()
    } catch (err) {
      alert(err.message)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-warning',
      sent_to_vendor: 'badge-primary',
      under_repair: 'badge-warning',
      repair_pending: 'badge-warning',
      repair_completed: 'badge-success',
      resolved_vendor: 'badge-success',
      repair_pending_confirmation: 'badge-warning',
      awaiting_employee_confirmation: 'badge-info',
      repair_rejected: 'badge-danger',
      resolution_rejected: 'badge-danger'
    }
    return <span className={`badge ${badges[status]}`}>{status.replace(/_/g, ' ')}</span>
  }

  return (
    <div>
      <div className="toolbar">
        <h3>My Issues - Device Repairs</h3>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Serial</th>
                <th>Issue Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Date Reported</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No issues assigned to you</td></tr>
              ) : issues.map(issue => (
                <tr key={issue.id}>
                  <td><strong>{issue.asset_tag}</strong> - {issue.model}</td>
                  <td>{issue.serial_number}</td>
                  <td><span className="badge badge-info">{issue.report_type}</span></td>
                  <td>{issue.description}</td>
                  <td>{getStatusBadge(issue.status)}</td>
                  <td>{new Date(issue.created_at).toLocaleDateString()}</td>
                  <td>
                    {issue.status === 'sent_to_vendor' || issue.status === 'under_repair' || issue.status === 'repair_pending' || issue.status === 'repair_rejected' ? (
                      <button className="btn btn-sm btn-primary" onClick={() => handleResolve(issue)}>Resolve</button>
                    ) : (
                      <span className="badge badge-info">
                        {issue.status === 'repair_pending_confirmation' ? 'Awaiting Procurement' :
                         issue.status === 'awaiting_employee_confirmation' ? 'Awaiting Employee' : 'Completed'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedIssue && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Resolve Issue</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <p><strong>Device:</strong> {selectedIssue.asset_tag} - {selectedIssue.model}</p>
                  <p><strong>Serial:</strong> {selectedIssue.serial_number}</p>
                  <p><strong>Brand:</strong> {selectedIssue.brand}</p>
                  <p><strong>Issue:</strong> {selectedIssue.description}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Resolution Status *</label>
                  <select className="form-select" value={formData.resolution_status} onChange={e => setFormData({...formData, resolution_status: e.target.value})} required>
                    <option value="resolved_vendor">Issue Resolved - Ready to Return</option>
                    <option value="under_repair">Under Repair - Need More Time</option>
                    <option value="repair_pending">Pending - Waiting for Parts</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Return Date</label>
                  <input type="date" className="form-input" value={formData.expected_return_date} onChange={e => setFormData({...formData, expected_return_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Resolution Notes (Optional)</label>
                  <textarea className="form-textarea" value={formData.resolution_notes} onChange={e => setFormData({...formData, resolution_notes: e.target.value})} placeholder="Describe the issue status or how it will be resolved..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Resolution</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Warranty Claims Page
function WarrantyPage() {
  const [claims, setClaims] = useState([])
  const [devices, setDevices] = useState([])
  const [vendors, setVendors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ device_id: '', vendor_id: '', type: 'repair', description: '' })

  useEffect(() => {
    loadClaims()
    loadDevices()
    loadVendors()
  }, [])

  const loadClaims = async () => {
    const data = await fetchAPI('/warranty-claims')
    setClaims(data)
  }

  const loadDevices = async () => {
    const data = await fetchAPI('/devices')
    setDevices(data)
  }

  const loadVendors = async () => {
    const data = await fetchAPI('/vendors')
    setVendors(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await fetchAPI('/warranty-claims', { method: 'POST', body: JSON.stringify(formData) })
      setShowModal(false)
      setFormData({ device_id: '', vendor_id: '', type: 'repair', description: '' })
      loadClaims()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleStatusUpdate = async (id, status) => {
    await fetchAPI(`/warranty-claims/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })
    loadClaims()
  }

  const getStatusBadge = (status) => {
    const badges = { pending: 'badge-warning', approved: 'badge-info', in_progress: 'badge-info', resolved: 'badge-success', rejected: 'badge-danger' }
    return <span className={`badge ${badges[status]}`}>{status}</span>
  }

  return (
    <div>
      <div className="toolbar">
        <h3>Warranty Claims</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Shield size={18} /> New Claim
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Claim #</th>
                <th>Device</th>
                <th>Vendor</th>
                <th>Type</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No warranty claims found</td></tr>
              ) : claims.map(claim => (
                <tr key={claim.id}>
                  <td><strong>{claim.claim_number}</strong></td>
                  <td>{claim.asset_tag} - {claim.model}</td>
                  <td>{claim.vendor_name}</td>
                  <td><span className="badge badge-info">{claim.type}</span></td>
                  <td>{getStatusBadge(claim.status)}</td>
                  <td>{new Date(claim.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="actions">
                      {claim.status === 'pending' && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => handleStatusUpdate(claim.id, 'approved')}>Approve</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleStatusUpdate(claim.id, 'rejected')}>Reject</button>
                        </>
                      )}
                      {claim.status === 'approved' && (
                        <button className="btn btn-sm btn-info" onClick={() => handleStatusUpdate(claim.id, 'in_progress')}>In Progress</button>
                      )}
                      {claim.status === 'in_progress' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleStatusUpdate(claim.id, 'resolved')}>Resolve</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Warranty Claim</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Device</label>
                  <select className="form-select" value={formData.device_id} onChange={e => setFormData({...formData, device_id: e.target.value})} required>
                    <option value="">Select Device</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.asset_tag} - {d.model}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <select className="form-select" value={formData.vendor_id} onChange={e => setFormData({...formData, vendor_id: e.target.value})} required>
                    <option value="">Select Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Claim Type</label>
                  <select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="repair">Repair</option>
                    <option value="replacement">Replacement</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Claim</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Maintenance Page
function MaintenancePage() {
  const [records, setRecords] = useState([])
  const [devices, setDevices] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ device_id: '', schedule_date: '', type: 'preventive', description: '', technician: '' })

  useEffect(() => {
    loadRecords()
    loadDevices()
  }, [])

  const loadRecords = async () => {
    const data = await fetchAPI('/maintenance')
    setRecords(data)
  }

  const loadDevices = async () => {
    const data = await fetchAPI('/devices')
    setDevices(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await fetchAPI('/maintenance', { method: 'POST', body: JSON.stringify(formData) })
      setShowModal(false)
      setFormData({ device_id: '', schedule_date: '', type: 'preventive', description: '', technician: '' })
      loadRecords()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleStatusUpdate = async (id, status) => {
    await fetchAPI(`/maintenance/${id}`, { method: 'PUT', body: JSON.stringify({ status, completion_date: status === 'completed' ? new Date().toISOString().split('T')[0] : null }) })
    loadRecords()
  }

  const getStatusBadge = (status) => {
    const badges = { scheduled: 'badge-warning', in_progress: 'badge-info', completed: 'badge-success', cancelled: 'badge-default' }
    return <span className={`badge ${badges[status]}`}>{status}</span>
  }

  return (
    <div>
      <div className="toolbar">
        <h3>Maintenance Records</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Wrench size={18} /> Schedule Maintenance
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Type</th>
                <th>Scheduled Date</th>
                <th>Technician</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No maintenance records found</td></tr>
              ) : records.map(record => (
                <tr key={record.id}>
                  <td><strong>{record.asset_tag}</strong> - {record.model}</td>
                  <td><span className="badge badge-info">{record.type}</span></td>
                  <td>{record.schedule_date}</td>
                  <td>{record.technician}</td>
                  <td>{getStatusBadge(record.status)}</td>
                  <td>
                    <div className="actions">
                      {record.status === 'scheduled' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleStatusUpdate(record.id, 'in_progress')}>Start</button>
                      )}
                      {record.status === 'in_progress' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleStatusUpdate(record.id, 'completed')}>Complete</button>
                      )}
                      {record.status !== 'completed' && record.status !== 'cancelled' && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleStatusUpdate(record.id, 'cancelled')}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule Maintenance</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Device</label>
                  <select className="form-select" value={formData.device_id} onChange={e => setFormData({...formData, device_id: e.target.value})} required>
                    <option value="">Select Device</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.asset_tag} - {d.model}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Maintenance Type</label>
                  <select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="preventive">Preventive</option>
                    <option value="corrective">Corrective</option>
                    <option value="upgrade">Upgrade</option>
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Scheduled Date</label>
                    <input type="date" className="form-input" value={formData.schedule_date} onChange={e => setFormData({...formData, schedule_date: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Technician</label>
                    <input className="form-input" value={formData.technician} onChange={e => setFormData({...formData, technician: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// SLA Page
function SLAPage() {
  const [agreements, setAgreements] = useState([])
  const [vendors, setVendors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingSLA, setEditingSLA] = useState(null)
  const [formData, setFormData] = useState({
    vendor_id: '', title: '', ceo_name: 'Dr Orlando Olumide Odejide', ceo_signature: '',
    delivery_timeline_days: '', warranty_months: 3, response_time_hours: '',
    specifications: '', quality_standards: '', replacement_policy: '', maintenance_expectations: '',
    start_date: '', end_date: '', status: 'draft'
  })

  useEffect(() => {
    loadAgreements()
    loadVendors()
  }, [])

  const loadAgreements = async () => {
    const data = await fetchAPI('/sla')
    setAgreements(data)
  }

  const loadVendors = async () => {
    const data = await fetchAPI('/vendors')
    setVendors(data)
  }

  const handleITManagerSignatureUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData({ ...formData, ceo_signature: reader.result })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleEditSLA = (agreement) => {
    setEditingSLA(agreement)
    setFormData({
      vendor_id: agreement.vendor_id || '',
      title: agreement.title || '',
      ceo_name: agreement.ceo_name || 'Dr Orlando Olumide Odejide',
      ceo_signature: agreement.ceo_signature || '',
      delivery_timeline_days: agreement.delivery_timeline_days || '',
      warranty_months: agreement.warranty_months || 3,
      response_time_hours: agreement.response_time_hours || '',
      specifications: agreement.specifications || '',
      quality_standards: agreement.quality_standards || '',
      replacement_policy: agreement.replacement_policy || '',
      maintenance_expectations: agreement.maintenance_expectations || '',
      start_date: agreement.start_date || '',
      end_date: agreement.end_date || '',
      status: agreement.status || 'draft'
    })
    setShowModal(true)
  }

  const handleDeleteSLA = async (id) => {
    if (confirm('Are you sure you want to delete this SLA agreement?')) {
      try {
        await fetchAPI(`/sla/${id}`, { method: 'DELETE' })
        loadAgreements()
      } catch (err) {
        alert(err.message)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = {
        ...formData,
        ceo_signature: formData.ceo_signature || null
      }
      if (editingSLA) {
        await fetchAPI(`/sla/${editingSLA.id}`, { method: 'PUT', body: JSON.stringify(submitData) })
      } else {
        await fetchAPI('/sla', { method: 'POST', body: JSON.stringify(submitData) })
      }
      setShowModal(false)
      setEditingSLA(null)
      setFormData({
        vendor_id: '', title: '', ceo_name: 'Dr Orlando Olumide Odejide', ceo_signature: '',
        delivery_timeline_days: '', warranty_months: 3, response_time_hours: '',
        specifications: '', quality_standards: '', replacement_policy: '', maintenance_expectations: '',
        start_date: '', end_date: '', status: 'draft'
      })
      loadAgreements()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const getStatusBadge = (status) => {
    const badges = { draft: 'badge-warning', active: 'badge-success', expired: 'badge-default' }
    return <span className={`badge ${badges[status]}`}>{status}</span>
  }

  return (
    <div>
      <div className="toolbar">
        <h3>SLA Agreements</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FileText size={18} /> New SLA
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Vendor</th>
                <th>Delivery (Days)</th>
                <th>Warranty (Months)</th>
                <th>Response (Hours)</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agreements.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">No SLA agreements found</td></tr>
              ) : agreements.map(agreement => (
                <tr key={agreement.id}>
                  <td><strong>{agreement.title}</strong></td>
                  <td>{agreement.vendor_name || '-'}</td>
                  <td>{agreement.delivery_timeline_days}</td>
                  <td>{agreement.warranty_months}</td>
                  <td>{agreement.response_time_hours}</td>
                  <td>{agreement.start_date}</td>
                  <td>{agreement.end_date}</td>
                  <td>{getStatusBadge(agreement.status)}</td>
                  <td>
                    <div className="actions">
                      <button className="btn-icon" onClick={() => handleEditSLA(agreement)}>Edit</button>
                      <button className="btn-icon" onClick={() => handleDeleteSLA(agreement.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>{editingSLA ? 'Edit SLA Agreement' : 'Create SLA Agreement'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Agreement Title</label>
                  <input className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">IT Manager Name</label>
                    <input className="form-input" value={formData.ceo_name} onChange={e => setFormData({...formData, ceo_name: e.target.value})} placeholder="Dr Orlando Olumide Odejide" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IT Manager Signature</label>
                    <input type="file" accept="image/*" className="form-input" onChange={handleITManagerSignatureUpload} style={{ padding: 8 }} />
                    {formData.ceo_signature && (
                      <img src={formData.ceo_signature} alt="IT Manager Signature" style={{ maxWidth: 150, maxHeight: 60, marginTop: 8, border: '1px solid #ccc', padding: 5 }} />
                    )}
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Delivery Timeline (Days)</label>
                    <input type="number" className="form-input" value={formData.delivery_timeline_days} onChange={e => setFormData({...formData, delivery_timeline_days: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Warranty Period (Months)</label>
                    <input type="number" className="form-input" value={formData.warranty_months} onChange={e => setFormData({...formData, warranty_months: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Response Time (Hours)</label>
                  <input type="number" className="form-input" value={formData.response_time_hours} onChange={e => setFormData({...formData, response_time_hours: e.target.value})} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-input" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input type="date" className="form-input" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Specifications</label>
                  <textarea className="form-textarea" value={formData.specifications} onChange={e => setFormData({...formData, specifications: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Quality Standards</label>
                  <textarea className="form-textarea" value={formData.quality_standards} onChange={e => setFormData({...formData, quality_standards: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Replacement Policy</label>
                  <textarea className="form-textarea" value={formData.replacement_policy} onChange={e => setFormData({...formData, replacement_policy: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Maintenance Expectations</label>
                  <textarea className="form-textarea" value={formData.maintenance_expectations} onChange={e => setFormData({...formData, maintenance_expectations: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingSLA ? 'Update SLA' : 'Create SLA'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Reports Page
function ReportsPage() {
  const [warrantyExpiry, setWarrantyExpiry] = useState([])
  const [warrantyDetails, setWarrantyDetails] = useState([])
  const [deviceCondition, setDeviceCondition] = useState([])
  const [vendorPerformance, setVendorPerformance] = useState([])
  const [deviceAllocation, setDeviceAllocation] = useState([])

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    const [we, wd, dc, vp, da] = await Promise.all([
      fetchAPI('/reports/warranty-expiry'),
      fetchAPI('/reports/warranty-details'),
      fetchAPI('/reports/device-condition'),
      fetchAPI('/reports/vendor-performance'),
      fetchAPI('/reports/device-allocation')
    ])
    setWarrantyExpiry(we)
    setWarrantyDetails(wd)
    setDeviceCondition(dc)
    setVendorPerformance(vp)
    setDeviceAllocation(da)
  }

  return (
    <div>
      <h3 style={{ marginBottom: 24 }}>Reports & Analytics</h3>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Warranty Expiring Soon (30 days)</h4>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Model</th>
                  <th>Expiry Date</th>
                  <th>Days Left</th>
                </tr>
              </thead>
              <tbody>
                {warrantyExpiry.length === 0 ? (
                  <tr><td colSpan={4} className="empty-state">No warranties expiring soon</td></tr>
                ) : warrantyExpiry.map(d => (
                  <tr key={d.asset_tag}>
                    <td>{d.asset_tag}</td>
                    <td>{d.model}</td>
                    <td>{d.warranty_expiry}</td>
                    <td><span className="badge badge-warning">{d.days_remaining} days</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Device Condition Summary</h4>
          </div>
          <div style={{ padding: 16 }}>
            {deviceCondition.map(c => (
              <div key={c.condition} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ textTransform: 'capitalize' }}>{c.condition}</span>
                <strong>{c.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h4 className="card-title">Warranty Details - All Devices</h4>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Model</th>
                <th>Brand</th>
                <th>Serial Number</th>
                <th>Vendor</th>
                <th>Warranty Expiry</th>
                <th>Status</th>
                <th>Claim Number</th>
              </tr>
            </thead>
            <tbody>
              {warrantyDetails.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No warranty data</td></tr>
              ) : warrantyDetails.map(d => (
                <tr key={d.id}>
                  <td><strong>{d.asset_tag}</strong></td>
                  <td>{d.model}</td>
                  <td>{d.brand}</td>
                  <td>{d.serial_number}</td>
                  <td>{d.vendor_name || '-'}</td>
                  <td>{d.warranty_expiry || 'N/A'}</td>
                  <td>
                    <span className={`badge ${
                      d.warranty_status_display === 'Active' ? 'badge-success' :
                      d.warranty_status_display === 'Expiring Soon' ? 'badge-warning' :
                      d.warranty_status_display === 'Expired' ? 'badge-danger' :
                      'badge-default'
                    }`}>
                      {d.warranty_status_display || 'N/A'}
                    </span>
                  </td>
                  <td>{d.claim_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Vendor Performance</h4>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Rating</th>
                  <th>On-Time %</th>
                  <th>Quality %</th>
                </tr>
              </thead>
              <tbody>
                {vendorPerformance.length === 0 ? (
                  <tr><td colSpan={4} className="empty-state">No vendor data</td></tr>
                ) : vendorPerformance.map(v => (
                  <tr key={v.name}>
                    <td>{v.name}</td>
                    <td style={{ color: '#F7931E' }}>{'★'.repeat(v.rating)}</td>
                    <td>{v.on_time_delivery}%</td>
                    <td>{v.quality_score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Device Allocation History</h4>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Issue Date</th>
                </tr>
              </thead>
              <tbody>
                {deviceAllocation.length === 0 ? (
                  <tr><td colSpan={4} className="empty-state">No allocations</td></tr>
                ) : deviceAllocation.slice(0, 5).map(a => (
                  <tr key={a.asset_tag}>
                    <td>{a.asset_tag}</td>
                    <td>{a.employee_name}</td>
                    <td>{a.department}</td>
                    <td>{a.issue_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// Users Page (Admin only - no employee role)
function UsersPage() {
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'procurement', department: '', phone: '' })
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    loadUsers()
    const interval = setInterval(loadUsers, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadUsers = async () => {
    const data = await fetchAPI('/users')
    setUsers(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingUser) {
        // Update existing user
        const updateData = { ...formData }
        if (!updateData.password) delete updateData.password
        await fetchAPI(`/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(updateData) })
      } else {
        // Create new user
        await fetchAPI('/auth/register', { method: 'POST', body: JSON.stringify(formData) })
      }
      setShowModal(false)
      setEditingUser(null)
      setFormData({ name: '', email: '', password: '', role: 'procurement', department: '', phone: '' })
      loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: normalizeRole(user.role),
      department: user.department || '',
      phone: user.phone || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await fetchAPI(`/users/${id}`, { method: 'DELETE' })
        loadUsers()
      } catch (err) {
        alert(err.message)
      }
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
    setFormData({ name: '', email: '', password: '', role: 'procurement', department: '', phone: '' })
  }

  const getRoleBadge = (role) => {
    const badges = { it_admin: 'badge-danger', procurement: 'badge-warning', vendor: 'badge-default' }
    return <span className={`badge ${badges[role]}`}>{role.replace('_', ' ')}</span>
  }

  return (
    <div>
      <div className="toolbar">
        <h3>User Management</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Users size={18} /> Add User
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No users found</td></tr>
              ) : users.map(user => (
                <tr key={user.id}>
                  <td><strong>{user.name}</strong></td>
                  <td>{user.email}</td>
                  <td>{getRoleBadge(normalizeRole(user.role))}</td>
                  <td>{user.department}</td>
                  <td>{user.phone}</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    {currentUser.role === 'it_admin' && (
                      <div className="actions">
                        <button className="btn-icon" onClick={() => handleEdit(user)}>Edit</button>
                        {user.id !== currentUser.id && (
                          <button className="btn-icon" onClick={() => handleDelete(user.id)}>Delete</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"} required={!editingUser} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-select" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                      <option value="procurement">Procurement</option>
                      <option value="it_admin">IT Admin</option>
                      <option value="vendor">Vendor</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input className="form-input" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingUser ? 'Update User' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Main App with Routing
function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [activePage, setActivePage] = useState('dashboard')
  const [globalModal, setGlobalModal] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    if (token) {
      const savedUser = localStorage.getItem('user')
      if (savedUser) setUser(JSON.parse(savedUser))
    }
  }, [token])

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 10000) // Refresh notifications every 10 seconds
    return () => clearInterval(interval)
  }, [token])

  const loadNotifications = async () => {
    if (!token) return
    try {
      const data = await fetchAPI('/notifications')
      setNotifications(data)
      setNotificationCount(data.filter(n => !n.is_read).length)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    const handleOpenModal = (e) => {
      const modalType = e.detail
      if (modalType === 'device') {
        setActivePage('devices')
        setGlobalModal('device')
      } else if (modalType === 'vendor') {
        setActivePage('vendors')
        setGlobalModal('vendor')
      } else if (modalType === 'request') {
        setActivePage('requests')
        setGlobalModal('request')
      }
    }
    window.addEventListener('openModal', handleOpenModal)
    return () => window.removeEventListener('openModal', handleOpenModal)
  }, [])

  const handleLogin = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  // Check if vendor - redirect to vendor registration if needed
  if (normalizeRole(user?.role) === 'vendor') {
    const vendorStatus = user.vendor_status
    if (vendorStatus === 'pending_sla') {
      return <Navigate to="/vendor-sla" />
    }
  }

  // Check if password reset page
  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordPage />
  }

  // Check if public employee report page
  if (window.location.pathname === '/report-issue') {
    return <EmployeeReportPage />
  }

  // Check if vendor SLA page (public - for vendors to sign SLA)
  if (window.location.pathname === '/vendor-sla') {
    return <VendorSLAPage />
  }

  // Check if vendor registration page (public)
  if (window.location.pathname === '/vendor-register') {
    return <VendorRegisterPage />
  }

  // Check if employee confirm device page
  if (window.location.pathname === '/confirm-device') {
    return <EmployeeConfirmDevicePage />
  }

  // If not logged in, show login page
  if (!token || !user) {
    return <LoginPage onLogin={handleLogin} />
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard user={user} />
      case 'devices': return <DevicesPage globalModal={globalModal} setGlobalModal={setGlobalModal} />
      case 'vendors': return <VendorsPage globalModal={globalModal} setGlobalModal={setGlobalModal} />
      case 'requests': return <RequestsPage globalModal={globalModal} setGlobalModal={setGlobalModal} />
      case 'allocations': return <AllocationsPage />
      case 'warranty': return <WarrantyPage />
      case 'maintenance': return <MaintenancePage />
      case 'sla': return <SLAPage />
      case 'reports': return <ReportsPage />
      case 'employee_reports': return <EmployeeReportsPage />
      case 'procurement_issues': return <ProcurementIssuesPage />
      case 'users': return <UsersPage />
      case 'vendor_issues': return <VendorIssuesPage />
      default: return <Dashboard user={user} />
    }
  }

  const pageTitles = {
    dashboard: 'Dashboard',
    devices: 'Device Management',
    vendors: 'Vendor Management',
    requests: 'Purchase Requests',
    allocations: 'Device Allocations',
    warranty: 'Warranty Claims',
    maintenance: 'Maintenance',
    sla: 'SLA Agreements',
    reports: 'Reports',
    employee_reports: 'Issue Reports',
    procurement_issues: 'Verify Vendor Issues',
    users: 'User Management',
    vendor_issues: 'My Issues'
  }

  return (
    <div className="app-container">
      <Sidebar activePage={activePage} setActivePage={setActivePage} user={user} onLogout={handleLogout} />
      <main className="main-content">
        <header className="header">
          <div className="header-left">
            <h2>{pageTitles[activePage]}</h2>
          </div>
          <div className="header-right">
            <div style={{ position: 'relative' }}>
              <button className="notification-btn" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={20} />
                {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
              </button>
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <h4>Notifications</h4>
                    <div>
                      <button className="btn-icon" onClick={() => { fetchAPI('/notifications/read-all', { method: 'PUT' }).then(() => loadNotifications()) }}>Clear All</button>
                      <button className="btn-icon" onClick={() => { setShowNotifications(false); loadNotifications(); }}>Refresh</button>
                    </div>
                  </div>
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <div className="notification-empty">No notifications</div>
                    ) : (
                      notifications.slice(0, 10).map(n => (
                        <div key={n.id} className={`notification-item ${!n.is_read ? 'unread' : ''}`}>
                          <div className="notification-title">{n.title}</div>
                          <div className="notification-message">{n.message}</div>
                          <div className="notification-time">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="page-content">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}

export default App