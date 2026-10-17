import React, { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import AdminIcon from '../components/AdminIcons.jsx';
import api from '../api';

export default function LetterIssued() {
  const { id } = useParams();
  const { state } = useLocation();
  const [escalation, setEscalation] = useState(state?.escalation || null);
  const [loading, setLoading] = useState(!state?.escalation);

  useEffect(() => {
    if (!escalation && id) {
      setLoading(true);
      api.get(`/escalations/${id}`)
        .then((res) => {
          setEscalation(res.data);
        })
        .catch((err) => {
          console.error('[LetterIssued] Error loading escalation:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [id, escalation]);

  const issueDate = escalation?.escalated
    ? new Date(escalation.escalated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const downloadPdf = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const left = 22;
    const right = 188;
    let y = 24;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('BARANGAY POBLACION', 105, y, { align: 'center' });
    y += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text('LOCAL GOVERNMENT UNIT', 105, y, { align: 'center' });
    y += 12;
    pdf.setDrawColor(30, 64, 175);
    pdf.line(left, y, right, y);
    y += 14;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('FORMAL ESCALATION LETTER', 105, y, { align: 'center' });
    y += 14;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Date: ${issueDate}`, left, y);
    y += 9;
    pdf.text(`To: ${escalation?.toDepartment || 'Recipient Department'}`, left, y);
    y += 6;
    pdf.text(`Attn: ${escalation?.toRecipient || 'Concerned Officer'}`, left, y);
    y += 12;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Subject: ${escalation?.subject || 'Escalation Letter'}`, left, y);
    y += 12;
    pdf.setFont('helvetica', 'normal');
    const body = escalation?.body || 'No letter body was provided.';
    const bodyLines = pdf.splitTextToSize(body, right - left);
    pdf.text(bodyLines, left, y, { maxWidth: right - left, lineHeightFactor: 1.6 });
    y += bodyLines.length * 6 + 18;
    pdf.text('Respectfully submitted,', left, y);
    y += 20;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Barangay Poblacion Administrative Office', left, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Reference: ${escalation?.id || id}`, left, y);
    pdf.save(`${escalation?.id || id}-escalation-letter.pdf`);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="letter-issued-banner print-hidden bg-navy-900 text-white rounded-xl p-6 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold bg-white/10 px-2 py-1 rounded">PROCESS COMPLETE</span>
          <h1 className="text-xl font-bold mt-2">Letter Issued Successfully</h1>
          <p className="text-sm text-slate-300 mt-1">
            The official escalation letter has been recorded in the civic ledger and dispatched to the
            respective department.
          </p>
        </div>
        <span className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
          <AdminIcon name="check" size={20} />
        </span>
      </div>

      <article className="letter-paper printable-document bg-white rounded-xl shadow-sm p-10 text-slate-800">
        {/* Official Header with Seal */}
        <header className="text-center border-b-2 border-blue-900 pb-5">
          <div className="flex items-center justify-center gap-4 mb-3">
            <img src="/barangay-seal.png" alt="Barangay Seal" className="w-16 h-16 object-contain" />
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Republic of the Philippines · Province of Cebu</p>
              <p className="text-xl font-bold tracking-wide text-slate-900 font-serif">BARANGAY POBLACION</p>
              <p className="text-xs text-slate-600 font-medium">Municipality of Cordova · Office of the Punong Barangay</p>
            </div>
            <div className="w-16 h-16 hidden sm:block"></div>
          </div>
          <p className="mt-4 text-lg font-bold text-blue-900 tracking-wider uppercase font-serif border-t border-slate-200 pt-3">
            OFFICIAL NOTICE OF ESCALATION & REFERRAL
          </p>
        </header>

        <div className="mt-8 space-y-2 text-sm">
          <p><span className="font-semibold text-slate-700">Date Issued:</span> {issueDate}</p>
          <p><span className="font-semibold text-slate-700">Referral Department:</span> {escalation?.toDepartment || 'Recipient Department / Agency'}</p>
          <p><span className="font-semibold text-slate-700">Attention:</span> {escalation?.toRecipient || 'Concerned Administrative Officer'}</p>
          <p className="pt-4"><span className="font-semibold text-slate-700">Subject:</span> {escalation?.subject || 'Formal Escalation Referral'}</p>
          {escalation?.caseRef && <p><span className="font-semibold text-slate-700">Barangay Case Reference:</span> {escalation.caseRef}</p>}
        </div>

        <div className="mt-8 whitespace-pre-wrap leading-relaxed text-[15px] text-slate-900 font-serif border-t border-b border-slate-100 py-6 min-h-[220px]">
          {escalation?.body || 'This case has been formally referred by the Barangay Administration for higher-level review and appropriate legal/administrative action.'}
        </div>

        <div className="mt-12 pt-6 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Case Tracking ID</p>
            <p className="font-mono font-bold text-slate-800 text-base">{escalation?.id || id}</p>
            <p className="text-xs text-slate-400 mt-1">Status: {escalation?.status || 'Under Review'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-8">Attested and Dispatched by:</p>
            <p className="font-bold text-slate-900 underline decoration-slate-400 decoration-1 underline-offset-4">Barangay Poblacion Administrative Office</p>
            <p className="text-xs text-slate-500 mt-1">LGU Cordova, Cebu</p>
          </div>
        </div>
      </article>

      <div className="letter-actions print-hidden flex justify-between items-center">
        <Link to="/escalation" className="text-sm text-blue-600 hover:underline">
          ← Return to Escalation Queue
        </Link>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg px-4 py-2.5">
            Print Letter
          </button>
          <button onClick={downloadPdf} className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-lg px-4 py-2.5">
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
