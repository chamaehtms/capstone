import React from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';

export default function LetterIssued() {
  const { id } = useParams();
  const { state } = useLocation();
  const escalation = state?.escalation;
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
        <span className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">✓</span>
      </div>

      <article className="letter-paper bg-white rounded-xl shadow-sm p-10 text-slate-800">
        <header className="text-center border-b-2 border-blue-700 pb-5">
          <p className="text-2xl font-bold tracking-wide">BARANGAY POBLACION</p>
          <p className="text-sm text-slate-500 tracking-widest">LOCAL GOVERNMENT UNIT</p>
          <p className="mt-5 text-xl font-bold text-blue-900">FORMAL ESCALATION LETTER</p>
        </header>

        <div className="mt-8 space-y-2 text-sm">
          <p><span className="font-semibold">Date:</span> {issueDate}</p>
          <p><span className="font-semibold">To:</span> {escalation?.toDepartment || 'Recipient Department'}</p>
          <p><span className="font-semibold">Attention:</span> {escalation?.toRecipient || 'Concerned Officer'}</p>
          <p className="pt-4"><span className="font-semibold">Subject:</span> {escalation?.subject || 'Escalation Letter'}</p>
          {escalation?.caseRef && <p><span className="font-semibold">Case Reference:</span> {escalation.caseRef}</p>}
          <p><span className="font-semibold">Priority:</span> {escalation?.priority || 'Medium'}</p>
        </div>

        <p className="mt-8 whitespace-pre-wrap leading-8 text-[15px]">
          {escalation?.body || 'No letter body was provided.'}
        </p>

        <div className="mt-12">
          <p className="text-sm">Respectfully submitted,</p>
          <p className="mt-10 font-semibold">Barangay Poblacion Administrative Office</p>
          <p className="mt-1 text-sm text-slate-500">Reference: {escalation?.id || id}</p>
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
