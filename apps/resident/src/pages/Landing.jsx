import React from 'react';
import { Link } from 'react-router-dom';
import ModernIcon from '../components/ModernIcons.jsx';

const backgroundImage = '/barangay-bg.png';

export default function Landing() {
  return (
    <div
      className="landing-page"
      style={{
        backgroundColor: 'rgba(7, 16, 29, 0.72)',
        backgroundImage: `url(${backgroundImage})`,
        backgroundBlendMode: 'overlay',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <header className="landing-header">
        <div className="landing-brand">
          <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="landing-logo" />
          <div>
            <strong>Barangay Poblacion</strong>
          </div>
        </div>

        <nav className="landing-nav">
          <Link to="/login" className="landing-btn landing-btn-ghost">
            Login
          </Link>
          <Link to="/register" className="landing-btn landing-btn-primary">
            Sign Up
          </Link>
        </nav>
      </header>

      <main className="landing-split-container">
        {/* Left Column: Civic Hero Statement */}
        <section className="landing-lead">
          <h1>Civic resolution & resident services, direct to your barangay.</h1>
          <p className="landing-subtext">
            Submit formal disputes under Katarungang Pambarangay, track case hearings in real-time,
            and access official community certifications with transparent local governance.
          </p>

          <div className="landing-actions">
            <Link to="/register" className="landing-btn landing-btn-primary landing-btn-large">
              Register as Resident
            </Link>
            <Link to="/login" className="landing-btn landing-btn-ghost landing-btn-large">
              Access My Portal →
            </Link>
          </div>

          <div className="landing-proof-strip">
            <div className="proof-item">
              <span className="proof-label">Jurisdiction</span>
              <strong>Barangay Poblacion</strong>
            </div>
            <div className="proof-divider" />
            <div className="proof-item">
              <span className="proof-label">Dispute System</span>
              <strong>Lupon Tagapamayapa</strong>
            </div>
            <div className="proof-divider" />
            <div className="proof-item">
              <span className="proof-label">Verification</span>
              <strong>Government Issued ID</strong>
            </div>
          </div>
        </section>

        {/* Right Column: Direct Public Quick Actions */}
        <aside className="landing-quick-portal">
          <div className="quick-portal-header">
            <h3>Immediate Public Services</h3>
            <span>Direct Processing</span>
          </div>

          <div className="quick-portal-grid">
            <Link to="/login" className="quick-service-tile">
              <div className="tile-icon-svg">
                <ModernIcon name="scale" size={20} color="#93c5fd" />
              </div>
              <div className="tile-text">
                <strong>File a Formal Complaint</strong>
                <p>Submit neighborhood disputes, noise disturbances, or civil concerns.</p>
              </div>
              <span className="tile-arrow">→</span>
            </Link>

            <Link to="/login" className="quick-service-tile">
              <div className="tile-icon-svg">
                <ModernIcon name="track" size={20} color="#93c5fd" />
              </div>
              <div className="tile-text">
                <strong>Track Case Status</strong>
                <p>Verify hearing dates, mediation minutes, and resolution notices.</p>
              </div>
              <span className="tile-arrow">→</span>
            </Link>

            <Link to="/login" className="quick-service-tile">
              <div className="tile-icon-svg">
                <ModernIcon name="document" size={20} color="#93c5fd" />
              </div>
              <div className="tile-text">
                <strong>Barangay Clearance & Certs</strong>
                <p>Request proof of residency, indigency, and business clearances.</p>
              </div>
              <span className="tile-arrow">→</span>
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
