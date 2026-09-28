import React from 'react';
import { Link } from 'react-router-dom';

const backgroundImage = '/barangay-bg.png';

export default function Landing() {
  return (
    <div
      className="landing-page"
      style={{
        backgroundImage: `linear-gradient(rgba(7, 16, 29, 0.64), rgba(7, 16, 29, 0.7)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <header className="landing-header">
        <div className="landing-brand">
          <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="landing-logo" />
          <div>
            <span className="landing-brand-label">Barangay</span>
            <strong>Poblacion</strong>
          </div>
        </div>

        <nav className="landing-nav">
          <Link to="/login" className="landing-btn landing-btn-ghost">
            Sign In
          </Link>
          <Link to="/register" className="landing-btn landing-btn-primary">
            Sign Up
          </Link>
        </nav>
      </header>

      <main className="landing-content">
        <div className="landing-copy">
          <span className="landing-kicker">Community Service Portal</span>
          <h1>Barangay support for every resident.</h1>
          <p>
            Submit concerns, track case updates, and connect with your local government through a
            secure and simple digital experience.
          </p>

          <div className="landing-actions">
            <Link to="/register" className="landing-btn landing-btn-primary landing-btn-large">
              Create Account
            </Link>
            <Link to="/login" className="landing-btn landing-btn-ghost landing-btn-large">
              Resident Login
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
