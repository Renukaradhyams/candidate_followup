"use client";

import React, { useState, useEffect } from 'react';
import { API } from '../../services/api';
import ToastContainer, { showToast } from '../../components/Toast';

export default function CandidateEntryPage() {
  const [step, setStep] = useState(1);
  const [designations, setDesignations] = useState<string[]>([]);
  const [dupWarn, setDupWarn] = useState('');

  // Form Fields - Step 1
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [dob, setDob] = useState('');
  const [offeredDoj, setOfferedDoj] = useState('');
  const [desig, setDesig] = useState('');
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('');
  const [retailExperience, setRetailExperience] = useState('');
  const [previousCompany, setPreviousCompany] = useState('');
  const [previousDesignation, setPreviousDesignation] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [fatherDetails, setFatherDetails] = useState('');
  const [motherDetails, setMotherDetails] = useState('');
  const [religionCaste, setReligionCaste] = useState('');
  const [languagesKnown, setLanguagesKnown] = useState<string[]>([]);
  
  // Step 2 Questions
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('Yes');
  const [q4, setQ4] = useState('');

  // Files
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);

  const [declaration, setDeclaration] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successAppNo, setSuccessAppNo] = useState('');

  useEffect(() => {
    API.getDesignations().then(res => {
      if (res && res.designations) setDesignations(res.designations);
    }).catch(() => {});
  }, []);

  const checkDuplicate = async (ph: string) => {
    if (ph.length < 10) {
      setDupWarn('');
      return;
    }
    try {
      const d = await API.checkDuplicate(ph);
      if (d.exists) {
        setDupWarn(`⚠️ This number was already used by ${d.name} (${d.appNo}, applied ${d.appliedOn}).`);
      } else {
        setDupWarn('');
      }
    } catch (e) {}
  };

  const handleLangToggle = (lang: string) => {
    setLanguagesKnown(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const handleGoStep2 = () => {
    if (!name.trim() || !phone.trim() || !dob || !gender || !address.trim() || !desig || !qualification || !experience || !aadhaarNumber || !fatherDetails || !motherDetails) {
      showToast('Please fill out all mandatory fields in Step 1', 'error');
      return;
    }
    setStep(2);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!declaration) {
      showToast('You must agree to the declaration', 'error');
      return;
    }
    if (!resumeFile || !photoFile || !aadhaarFile) {
      showToast('Please upload all mandatory documents', 'error');
      return;
    }
    if (!q1.trim() || !q2.trim() || !q4.trim()) {
      showToast('Please answer all questions in Step 2', 'error');
      return;
    }

    setLoading(true);
    try {
      // In a real app we would upload files first and get URLs.
      // For now we mock the URLs.
      const resumeUrl = resumeFile ? URL.createObjectURL(resumeFile) : '';
      const photoUrl = photoFile ? URL.createObjectURL(photoFile) : '';
      const aadhaarUrl = aadhaarFile ? URL.createObjectURL(aadhaarFile) : '';

      const res = await API.addCandidate({
        name,
        email,
        phone: '+91' + phone,
        address,
        gender,
        bloodGroup,
        dob,
        offeredDoj,
        desig,
        qualification,
        experience,
        retailExperience,
        previousCompany,
        previousDesignation,
        aadhaarNumber,
        fatherDetails,
        motherDetails,
        religionCaste,
        languagesKnown,
        q1, q2, q3, q4,
        resumeUrl,
        photoUrl,
        aadhaarUrl,
        isDuplicatePhone: dupWarn ? 'Yes' : 'No',
        source: 'Form',
        expectedSalary: 0
      });

      if (res.success && res.appNo) {
        setSuccessAppNo(res.appNo);
        showToast('Registration successful!', 'success');
        setStep(3);
      } else {
        showToast('Registration failed: ' + (res.error || 'Unknown error'), 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const POSITIONS = ['Sales Executive', 'Cashier', 'Billing Executive', 'HR', 'Store Assistant', 'Stock Executive', 'Visual Merchandiser', 'Floor Manager', 'Security', 'Housekeeping', 'Helper', 'Other'];
  const QUALIFICATIONS = ['SSLC', 'PUC', 'Diploma', 'Graduate', 'Other'];
  const EXP_LEVELS = ['Fresher', 'Less than 1 Year', '1-2 Years', '2-5 Years', 'More than 5 Years'];
  const LANGUAGES = ['Kannada', 'English', 'Hindi', 'Telugu', 'Tamil', 'Marathi'];

  return (
    <div className="min-h-screen bg-[#EDE8DE]">
      <ToastContainer />

      {/* Header */}
      <div className="bg-[#1E2D4E] p-4 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#C9952A] font-black flex items-center justify-center text-sm shadow">
            BSC
          </div>
          <div>
            <h1 className="font-extrabold text-base leading-tight">BSC Candidate Registration</h1>
            <div className="text-[10px] text-white/50 uppercase tracking-widest">BSC The Textile Mall · Since 1938</div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 lg:p-6">
        {step !== 3 && (
          <div className="flex items-center justify-between text-xs font-bold mb-4 bg-white p-3 rounded-xl border border-[#e0ddd8]">
            <span className={step === 1 ? 'text-[#1E2D4E]' : 'text-[#888888]'}>Step 1: Personal Details</span>
            <span className={step === 2 ? 'text-[#1E2D4E]' : 'text-[#888888]'}>Step 2: Documents &amp; Screening</span>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-xl border border-[#e0ddd8] space-y-5 text-xs">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-xs font-black uppercase text-[#1E2D4E] tracking-wider border-b border-[#e0ddd8] pb-2">
                Personal Information
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Full Name (As per Aadhaar) *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Phone Number *</label>
                  <div className="flex">
                    <span className="p-2.5 bg-[#F9F7F4] border border-r-0 border-[#e0ddd8] rounded-l-lg font-bold text-[#555555]">+91</span>
                    <input type="tel" maxLength={10} value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); checkDuplicate(e.target.value); }} placeholder="10-digit number" className="w-full p-2.5 rounded-r-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                  </div>
                  {dupWarn && <div className="p-2 mt-1 rounded bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-medium">{dupWarn}</div>}
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Gender *</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]">
                    <option value="">Select</option>
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Date of Birth *</label>
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Blood Group</label>
                  <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]">
                    <option value="">Select</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Current/Permanent Address *</label>
                <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full Address" className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Aadhaar Number *</label>
                  <input type="text" value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value)} placeholder="12-digit Aadhaar" className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Religion &amp; Caste / Category</label>
                  <input type="text" value={religionCaste} onChange={(e) => setReligionCaste(e.target.value)} placeholder="Religion & Caste" className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Father's Name &amp; Occupation *</label>
                  <input type="text" value={fatherDetails} onChange={(e) => setFatherDetails(e.target.value)} placeholder="Father details" className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Mother's Name &amp; Occupation *</label>
                  <input type="text" value={motherDetails} onChange={(e) => setMotherDetails(e.target.value)} placeholder="Mother details" className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-2">Languages Known *</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <label key={lang} className="flex items-center gap-1 bg-[#F9F7F4] border border-[#e0ddd8] px-3 py-1.5 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={languagesKnown.includes(lang)} onChange={() => handleLangToggle(lang)} />
                      {lang}
                    </label>
                  ))}
                </div>
              </div>

              <div className="text-xs font-black uppercase text-[#1E2D4E] tracking-wider border-b border-[#e0ddd8] pb-2 pt-2">
                Professional Information
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Position Selected For *</label>
                  <select value={desig} onChange={(e) => setDesig(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]">
                    <option value="">Select</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Highest Qualification *</label>
                  <select value={qualification} onChange={(e) => setQualification(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]">
                    <option value="">Select</option>
                    {QUALIFICATIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Total Work Experience *</label>
                  <select value={experience} onChange={(e) => setExperience(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]">
                    <option value="">Select</option>
                    {EXP_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Offered Date of Joining *</label>
                  <input type="date" value={offeredDoj} onChange={(e) => setOfferedDoj(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Do you have prior retail sales experience? *</label>
                <select value={retailExperience} onChange={(e) => setRetailExperience(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]">
                  <option value="">Select</option>
                  <option value="Yes, in a clothing/apparel store">Yes, in a clothing/apparel store</option>
                  <option value="Yes, in another type of retail store">Yes, in another type of retail store</option>
                  <option value="No, I do not have retail experience">No, I do not have retail experience</option>
                </select>
              </div>

              {experience !== 'Fresher' && experience !== '' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Previous Company Name</label>
                    <input type="text" value={previousCompany} onChange={(e) => setPreviousCompany(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Previous Designation</label>
                    <input type="text" value={previousDesignation} onChange={(e) => setPreviousDesignation(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
                  </div>
                </div>
              )}

              <div className="pt-3">
                <button type="button" onClick={handleGoStep2} className="w-full py-3 rounded-xl bg-[#1E2D4E] text-white font-bold text-xs shadow-lg hover:bg-[#162340]">
                  Continue to Documents & Questions →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-xs font-black uppercase text-[#1E2D4E] tracking-wider border-b border-[#e0ddd8] pb-2">
                Document Uploads
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-[#e0ddd8] rounded-xl bg-[#F9F7F4]">
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-2">Upload Resume *</label>
                  <input type="file" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} className="text-[10px] w-full" />
                  <p className="text-[9px] text-[#888] mt-1">1 supported file. Max 10 MB.</p>
                </div>
                <div className="p-4 border border-[#e0ddd8] rounded-xl bg-[#F9F7F4]">
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-2">Passport Size Photo *</label>
                  <input type="file" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} accept="image/*" className="text-[10px] w-full" />
                  <p className="text-[9px] text-[#888] mt-1">1 supported file. Max 10 MB.</p>
                </div>
                <div className="p-4 border border-[#e0ddd8] rounded-xl bg-[#F9F7F4]">
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-2">Aadhaar Card *</label>
                  <input type="file" onChange={(e) => setAadhaarFile(e.target.files?.[0] || null)} accept="image/*,.pdf" className="text-[10px] w-full" />
                  <p className="text-[9px] text-[#888] mt-1">1 supported file. Max 10 MB.</p>
                </div>
              </div>

              <div className="text-xs font-black uppercase text-[#1E2D4E] tracking-wider border-b border-[#e0ddd8] pb-2 pt-2">
                Screening Questions
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-[#1E2D4E]">1. Why do you want to join BSC Exclusive? *</label>
                <textarea rows={2} value={q1} onChange={(e) => setQ1(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
              </div>
              <div className="space-y-1.5">
                <label className="block font-bold text-[#1E2D4E]">2. Why should we hire you? *</label>
                <textarea rows={2} value={q2} onChange={(e) => setQ2(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
              </div>
              <div className="space-y-1.5">
                <label className="block font-bold text-[#1E2D4E]">3. Comfortable working weekends/festivals? *</label>
                <select value={q3} onChange={(e) => setQ3(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-bold">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block font-bold text-[#1E2D4E]">4. Value in first 90 days? *</label>
                <textarea rows={2} value={q4} onChange={(e) => setQ4(e.target.value)} className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]" />
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} className="mt-1" />
                  <span className="text-[11px] leading-tight text-amber-900 font-medium">
                    <b>Declaration *</b><br/>
                    I hereby declare that all the information provided in this form is true, complete, and accurate to the best of my knowledge. I understand that any false or misleading information may lead to the cancellation of my employment offer or termination of employment. I also authorize BSC Textiles to verify the information and documents submitted by me for employment purposes.
                  </span>
                </label>
              </div>

              <div className="flex gap-[#3px] pt-3 gap-3">
                <button type="button" onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border border-[#e0ddd8] font-bold text-xs">
                  ← Back
                </button>
                <button type="button" disabled={loading} onClick={handleSubmit} className="flex-1 py-3 rounded-xl bg-[#1E2D4E] text-white font-bold text-xs shadow-lg hover:bg-[#162340] disabled:opacity-50">
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8 space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl font-black mx-auto">
                ✓
              </div>
              <h2 className="text-xl font-black text-[#1E2D4E]">Registration Successful!</h2>
              <p className="text-xs text-[#888888]">Your application has been submitted to BSC Exclusive</p>

              <div className="p-4 rounded-xl bg-[#F9F7F4] border border-[#e0ddd8] inline-block">
                <div className="text-[10px] text-[#888888] font-bold uppercase">Application Number</div>
                <div className="text-2xl font-black text-[#1E2D4E] font-mono mt-1">{successAppNo}</div>
              </div>

              <div>
                <button onClick={() => window.location.reload()} className="px-6 py-3 rounded-xl bg-[#1E2D4E] text-white font-bold text-xs shadow-lg hover:bg-[#162340]">
                  Register Another Candidate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
