import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import { 
  User, Phone, Mail, MapPin, Calendar, Briefcase, Award, 
  FileText, ShieldCheck, CheckCircle2, Upload, Sparkles, ArrowRight, ArrowLeft, Image, FileCheck
} from 'lucide-react';

export default function CandidateEntryPage() {
  const [step, setStep] = useState(1);
  const [designations, setDesignations] = useState<string[]>([]);
  const [dupWarn, setDupWarn] = useState('');
  const [editAppNo, setEditAppNo] = useState<string | null>(null);

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

  // Files
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);

  const [existingResume, setExistingResume] = useState('');
  const [existingPhoto, setExistingPhoto] = useState('');
  const [existingAadhaar, setExistingAadhaar] = useState('');

  const [declaration, setDeclaration] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successAppNo, setSuccessAppNo] = useState('');

  useEffect(() => {
    API.getDesignations().then(res => {
      if (res && res.designations) setDesignations(res.designations);
    }).catch(() => {});

    // Check Edit Mode
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId) {
      setEditAppNo(editId);
      setLoading(true);
      API.call('getCandidates', { search: editId }).then(res => {
        if (res.candidates && res.candidates.length > 0) {
          const c = res.candidates[0];
          setName(c.name || '');
          setEmail(c.email || '');
          setPhone(c.phone || '');
          setAddress(c.address || '');
          setGender(c.gender || '');
          setBloodGroup(c.bloodGroup || '');
          setDob(c.dob ? c.dob.split('T')[0] : '');
          setOfferedDoj(c.offeredDoj ? c.offeredDoj.split('T')[0] : '');
          setDesig(c.desig || '');
          setQualification(c.qualification || '');
          setExperience(c.experience || '');
          setRetailExperience(c.retailExperience || '');
          setPreviousCompany(c.previousCompany || '');
          setPreviousDesignation(c.previousDesignation || '');
          setAadhaarNumber(c.aadhaarNumber || '');
          setFatherDetails(c.fatherDetails || '');
          setMotherDetails(c.motherDetails || '');
          setReligionCaste(c.religionCaste || '');
          setLanguagesKnown(c.languagesKnown ? (typeof c.languagesKnown === 'string' ? JSON.parse(c.languagesKnown) : c.languagesKnown) : []);
          setDeclaration(true);
          setExistingResume(c.resumeUrl || '');
          setExistingPhoto(c.photoUrl || '');
          setExistingAadhaar(c.aadharUrl || c.aadhaarUrl || '');
        }
        setLoading(false);
      }).catch(err => {
        showToast('Failed to load candidate data', 'error');
        setLoading(false);
      });
    }
  }, []);

  const checkDuplicate = async (ph: string) => {
    if (ph.length < 10) {
      setDupWarn('');
      return;
    }
    try {
      const d = await API.checkDuplicate(ph);
      if (d.exists) {
        setDupWarn(`⚠️ This phone number was already registered by ${d.name} (${d.appNo}, applied ${d.appliedOn}).`);
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
      showToast('Please fill out all mandatory fields marked with (*)', 'error');
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
    if (!editAppNo && (!resumeFile || !photoFile || !aadhaarFile)) {
      showToast('Please upload all mandatory documents', 'error');
      return;
    }

    setLoading(true);
    try {
      let resumeUrl = existingResume;
      let photoUrl = existingPhoto;
      let aadhaarUrl = existingAadhaar;

      if (resumeFile || photoFile || aadhaarFile) {
        const formData = new FormData();
        if (resumeFile) formData.append('resume', resumeFile);
        if (photoFile) formData.append('photo', photoFile);
        if (aadhaarFile) formData.append('aadhar', aadhaarFile);
        
        const uploadRes = await API.uploadDocuments(formData);
        if (uploadRes.success) {
          if (uploadRes.resumeUrl) resumeUrl = uploadRes.resumeUrl;
          if (uploadRes.photoUrl) photoUrl = uploadRes.photoUrl;
          if (uploadRes.aadhaarUrl) aadhaarUrl = uploadRes.aadhaarUrl;
        }
      }

      const payload = {
        name,
        email,
        phone,
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
        resumeUrl,
        photoUrl,
        aadhaarUrl,
        source: 'Walk-in',
        status: 'New'
      };

      if (editAppNo) {
        await API.call('updateCandidateFull', { appNo: editAppNo, ...payload });
        showToast('Registration details updated successfully!', 'success');
        setSuccessAppNo(editAppNo);
      } else {
        const res = await API.addCandidate(payload);
        setSuccessAppNo(res.appNo);
        showToast(`Registration Successful! App No: ${res.appNo}`, 'success');
      }

      setStep(3);
      window.scrollTo(0, 0);
    } catch (err: any) {
      showToast('Error submitting registration: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const defaultPositions = ['Sales Executive', 'Cashier', 'Billing Executive', 'HR', 'Store Assistant', 'Stock Executive', 'Visual Merchandiser', 'Floor Manager', 'Security', 'Housekeeping', 'Helper', 'Other'];
  const POSITIONS = Array.from(new Set([...(designations || []), ...defaultPositions])).filter(Boolean);
  const QUALIFICATIONS = ['SSLC', 'PUC', 'Diploma', 'Graduate', 'Other'];
  const EXP_LEVELS = ['Fresher', 'Less than 1 Year', '1–2 Years', '2–5 Years', 'More than 5 Years'];
  const LANGUAGES = ['Kannada', 'English', 'Hindi', 'Telugu', 'Tamil', 'Marathi'];

  return (
    <div className="min-h-screen bg-[#EDE8DE] pb-12">
      <ToastContainer />

      {/* Modern Header */}
      <header className="bg-[#1E2D4E] p-4 sm:p-5 text-white shadow-lg sticky top-0 z-30 border-b border-[#C9952A]/30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="BSC Logo" className="w-11 h-11 object-contain rounded-xl bg-white p-1 shadow-md border border-white/20" />
            <div>
              <h1 className="font-extrabold text-base sm:text-lg leading-tight tracking-tight">BSC Applicant Registration</h1>
              <div className="text-[10px] text-[#C9952A] font-bold uppercase tracking-widest mt-0.5">
                BSC The Textile Mall · Since 1938
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-bold bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
            <ShieldCheck className="w-4 h-4 text-[#C9952A]" />
            <span>Official Recruitment Portal</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Step Stepper Indicator */}
        {step !== 3 && (
          <div className="card-glass p-4 flex items-center justify-between text-xs font-extrabold">
            <div className={`flex items-center gap-2 ${step === 1 ? 'text-[#1E2D4E]' : 'text-[#888888]'}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${step === 1 ? 'bg-[#1E2D4E] text-white shadow-xs' : 'bg-[#F9F7F4] border'}`}>
                1
              </span>
              <span className="hidden sm:inline">Step 1: Personal &amp; Career Info</span>
              <span className="sm:hidden">Step 1</span>
            </div>

            <div className="h-0.5 flex-1 mx-4 bg-[#e2dfd7]" />

            <div className={`flex items-center gap-2 ${step === 2 ? 'text-[#1E2D4E]' : 'text-[#888888]'}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${step === 2 ? 'bg-[#1E2D4E] text-white shadow-xs' : 'bg-[#F9F7F4] border'}`}>
                2
              </span>
              <span className="hidden sm:inline">Step 2: Documents &amp; Declaration</span>
              <span className="sm:hidden">Step 2</span>
            </div>
          </div>
        )}

        {/* STEP 1 FORM */}
        {step === 1 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            {/* Section 1: Personal Details */}
            <div className="space-y-4">
              <div className="border-b border-[#e2dfd7] pb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-[#C9952A]" />
                <h2 className="text-sm font-extrabold uppercase text-[#1E2D4E] tracking-wider">
                  1. Personal &amp; Contact Details
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Full Name (As per Aadhaar) *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Mobile Phone Number *</label>
                  <div className="flex">
                    <span className="p-2.5 bg-[#e2dfd7]/50 border border-r-0 border-[#e2dfd7] rounded-l-xl font-extrabold text-xs text-[#555555] flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); checkDuplicate(e.target.value); }}
                      placeholder="10-digit mobile number"
                      className="input-modern rounded-l-none"
                    />
                  </div>
                  {dupWarn && (
                    <div className="p-2.5 mt-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
                      {dupWarn}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Gender *</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="select-modern">
                    <option value="">Select Gender</option>
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Blood Group</label>
                  <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="select-modern">
                    <option value="">Select Blood Group</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Complete Residential Address *</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House No, Street, Area, City, Pin Code"
                  className="textarea-modern"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Aadhaar Number (12 Digits) *</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={aadhaarNumber}
                    onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="12-digit Aadhaar number"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Religion &amp; Caste / Category</label>
                  <input
                    type="text"
                    value={religionCaste}
                    onChange={(e) => setReligionCaste(e.target.value)}
                    placeholder="e.g. Hindu / General"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Father's Name &amp; Occupation *</label>
                  <input
                    type="text"
                    value={fatherDetails}
                    onChange={(e) => setFatherDetails(e.target.value)}
                    placeholder="Father details"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Mother's Name &amp; Occupation *</label>
                  <input
                    type="text"
                    value={motherDetails}
                    onChange={(e) => setMotherDetails(e.target.value)}
                    placeholder="Mother details"
                    className="input-modern"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2D4E] mb-2">Languages Known *</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <label key={lang} className="flex items-center gap-1.5 bg-[#F9F7F4] border border-[#e2dfd7] px-3.5 py-2 rounded-xl cursor-pointer font-semibold text-xs text-[#1E2D4E] hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={languagesKnown.includes(lang)}
                        onChange={() => handleLangToggle(lang)}
                        className="rounded accent-[#1E2D4E]"
                      />
                      <span>{lang}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 2: Professional Information */}
            <div className="space-y-4 pt-4 border-t border-[#e2dfd7]">
              <div className="border-b border-[#e2dfd7] pb-3 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#C9952A]" />
                <h2 className="text-sm font-extrabold uppercase text-[#1E2D4E] tracking-wider">
                  2. Position &amp; Professional Details
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Position Applied For *</label>
                  <select value={desig} onChange={(e) => setDesig(e.target.value)} className="select-modern font-extrabold">
                    <option value="">Select Desired Role</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Highest Qualification *</label>
                  <select value={qualification} onChange={(e) => setQualification(e.target.value)} className="select-modern">
                    <option value="">Select Qualification</option>
                    {QUALIFICATIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Total Work Experience *</label>
                  <select value={experience} onChange={(e) => setExperience(e.target.value)} className="select-modern">
                    <option value="">Select Experience Level</option>
                    {EXP_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Offered / Expected Date of Joining</label>
                  <input
                    type="date"
                    value={offeredDoj}
                    onChange={(e) => setOfferedDoj(e.target.value)}
                    className="input-modern"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1E2D4E]">Prior Retail Sales Experience? *</label>
                <div className="space-y-2">
                  {[
                    'Yes, in a clothing/apparel store',
                    'Yes, in another type of retail store',
                    'No, fresher / no prior retail experience'
                  ].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 p-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] cursor-pointer text-xs font-semibold text-[#1E2D4E] hover:bg-white transition-colors">
                      <input
                        type="radio"
                        name="retailExp"
                        value={opt}
                        checked={retailExperience === opt}
                        onChange={(e) => setRetailExperience(e.target.value)}
                        className="accent-[#1E2D4E]"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Previous Company / Store Name</label>
                  <input
                    type="text"
                    value={previousCompany}
                    onChange={(e) => setPreviousCompany(e.target.value)}
                    placeholder="Previous employer name"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Previous Designation / Role</label>
                  <input
                    type="text"
                    value={previousDesignation}
                    onChange={(e) => setPreviousDesignation(e.target.value)}
                    placeholder="Previous role title"
                    className="input-modern"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-4 border-t border-[#e2dfd7]">
              <button
                type="button"
                onClick={handleGoStep2}
                className="btn-primary flex items-center gap-2 shadow-md"
              >
                <span>Proceed to Step 2: Documents</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 FORM */}
        {step === 2 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-[#e2dfd7] pb-3 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#C9952A]" />
              <h2 className="text-sm font-extrabold uppercase text-[#1E2D4E] tracking-wider">
                3. Mandatory Document Uploads &amp; Declaration
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Photo Upload */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-[#e2dfd7] bg-[#F9F7F4] text-center space-y-2 hover:border-[#1E2D4E] transition-colors">
                <Image className="w-8 h-8 text-[#C9952A] mx-auto" />
                <div className="font-extrabold text-xs text-[#1E2D4E]">Candidate Passport Photo *</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="photo-input"
                />
                <label htmlFor="photo-input" className="inline-block px-3 py-1.5 rounded-lg bg-white border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] cursor-pointer hover:bg-[#1E2D4E] hover:text-white transition-colors">
                  {photoFile ? photoFile.name : (existingPhoto ? 'Change Photo' : 'Choose Image')}
                </label>
              </div>

              {/* Aadhaar Upload */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-[#e2dfd7] bg-[#F9F7F4] text-center space-y-2 hover:border-[#1E2D4E] transition-colors">
                <FileCheck className="w-8 h-8 text-[#C9952A] mx-auto" />
                <div className="font-extrabold text-xs text-[#1E2D4E]">Aadhaar Card (Front/Back) *</div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAadhaarFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="aadhar-input"
                />
                <label htmlFor="aadhar-input" className="inline-block px-3 py-1.5 rounded-lg bg-white border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] cursor-pointer hover:bg-[#1E2D4E] hover:text-white transition-colors">
                  {aadhaarFile ? aadhaarFile.name : (existingAadhaar ? 'Change Aadhaar' : 'Choose Document')}
                </label>
              </div>

              {/* Resume Upload */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-[#e2dfd7] bg-[#F9F7F4] text-center space-y-2 hover:border-[#1E2D4E] transition-colors">
                <FileText className="w-8 h-8 text-[#C9952A] mx-auto" />
                <div className="font-extrabold text-xs text-[#1E2D4E]">Resume / CV Document *</div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={(e) => setResumeFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="resume-input"
                />
                <label htmlFor="resume-input" className="inline-block px-3 py-1.5 rounded-lg bg-white border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] cursor-pointer hover:bg-[#1E2D4E] hover:text-white transition-colors">
                  {resumeFile ? resumeFile.name : (existingResume ? 'Change Resume' : 'Choose File')}
                </label>
              </div>
            </div>

            {/* Declaration Checkbox */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer text-xs font-semibold text-[#1E2D4E]">
                <input
                  type="checkbox"
                  checked={declaration}
                  onChange={(e) => setDeclaration(e.target.checked)}
                  className="mt-0.5 rounded accent-[#1E2D4E]"
                />
                <span>
                  I hereby declare that all information provided in this registration form is true, correct, and complete to the best of my knowledge. I understand that any false statement or omission may lead to immediate disqualification.
                </span>
              </label>
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#e2dfd7]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] hover:bg-[#F9F7F4] flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Step 1</span>
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-gold flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {loading ? (
                  <span>Submitting Registration...</span>
                ) : (
                  <>
                    <span>Complete Candidate Registration</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 SUCCESS SCREEN */}
        {step === 3 && (
          <div className="card-glass p-8 sm:p-12 text-center space-y-5 animate-fade-in shadow-2xl my-8">
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-[#1E2D4E] tracking-tight">Registration Successfully Submitted! 🎉</h2>
              <p className="text-sm text-[#777777] font-medium mt-1">Thank you for submitting your application to BSC The Textile Mall.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#1E2D4E]/5 border border-[#1E2D4E]/10 inline-block">
              <span className="text-xs uppercase font-black text-[#777777] block">Application Reference Number</span>
              <span className="text-2xl font-mono font-black text-[#1E2D4E] tracking-wider">{successAppNo}</span>
            </div>

            <div className="pt-4 border-t border-[#e2dfd7] flex justify-center gap-3">
              <button
                onClick={() => window.location.href = '/candidate-entry'}
                className="btn-primary text-xs"
              >
                Submit Another Candidate Form
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
