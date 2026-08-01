"use client";

import React, { useState, useEffect } from 'react';
import { API } from '../../services/api';
import ToastContainer, { showToast } from '../../components/Toast';

export default function CandidateEntryPage() {
  const [step, setStep] = useState(1);
  const [designations, setDesignations] = useState<string[]>([]);
  const [dupWarn, setDupWarn] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [cityState, setCityState] = useState('');
  const [address, setAddress] = useState('');
  
  const [desig, setDesig] = useState('');
  const [occupation, setOccupation] = useState('');
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('');
  const [currentSalary, setCurrentSalary] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [ownVehicle, setOwnVehicle] = useState('No');
  
  const [source, setSource] = useState('Walk-in');
  const [referrer, setReferrer] = useState('');
  const [referrerEmpNo, setReferrerEmpNo] = useState('');
  const [sourceDetail, setSourceDetail] = useState('');

  // Step 2 Questions
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('Yes');
  const [q4, setQ4] = useState('');

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
        setDupWarn(`⚠️ This number was already used by ${d.name} (${d.appNo}, applied ${d.appliedOn}). You can still continue submitting.`);
      } else {
        setDupWarn('');
      }
    } catch (e) {}
  };

  const handleGoStep2 = () => {
    if (!name.trim() || !phone.trim() || !dob || !gender || !cityState.trim() || !address.trim() || !desig || !occupation.trim() || !qualification || !experience.trim() || !currentSalary.trim() || !expectedSalary || !noticePeriod.trim()) {
      showToast('Please fill out all mandatory fields in Step 1', 'error');
      return;
    }
    setStep(2);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!q1.trim() || !q2.trim() || !q3 || !q4.trim()) {
      showToast('Please answer all questions in Step 2', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await API.addCandidate({
        name,
        phone: '+91' + phone,
        email,
        dob,
        gender,
        cityState,
        address,
        desig,
        occupation,
        qualification,
        experience,
        currentSalary,
        expectedSalary: parseFloat(expectedSalary) || 0,
        salary: expectedSalary,
        noticePeriod,
        ownVehicle,
        source,
        referrer,
        referrerEmpNo,
        sourceDetail,
        q1, q2, q3, q4,
        isDuplicatePhone: dupWarn ? 'Yes' : 'No'
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
    } fontally {
      setLoading(false);
    }
  };

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
            <span className={step === 1 ? 'text-[#1E2D4E]' : 'text-[#888888]'}>Step 1: Personal &amp; Professional</span>
            <span className={step === 2 ? 'text-[#1E2D4E]' : 'text-[#888888]'}>Step 2: Screening Questions</span>
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
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Mobile Number *</label>
                  <div className="flex">
                    <span className="p-2.5 bg-[#F9F7F4] border border-r-0 border-[#e0ddd8] rounded-l-lg font-bold text-[#555555]">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setPhone(val);
                        checkDuplicate(val);
                      }}
                      placeholder="10-digit number"
                      className="w-full p-2.5 rounded-r-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                    />
                  </div>
                  {dupWarn && <div className="p-2 mt-1 rounded bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-medium">{dupWarn}</div>}
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-medium"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">City &amp; State *</label>
                <input
                  type="text"
                  value={cityState}
                  onChange={(e) => setCityState(e.target.value)}
                  placeholder="e.g. Belagavi, Karnataka"
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Address *</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full residential address"
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div className="text-xs font-black uppercase text-[#1E2D4E] tracking-wider border-b border-[#e0ddd8] pb-2 pt-2">
                Professional Information
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Position Applied For *</label>
                  <select
                    value={desig}
                    onChange={(e) => setDesig(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-medium"
                  >
                    <option value="">Select position</option>
                    {designations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Current Occupation *</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Sales Executive / Fresher"
                    className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Highest Qualification *</label>
                  <select
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-medium"
                  >
                    <option value="">Select qualification</option>
                    <option value="Below 10th">Below 10th</option>
                    <option value="PUC">PUC (12th)</option>
                    <option value="Graduate">Graduate</option>
                    <option value="Post Graduate">Post Graduate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Experience *</label>
                  <input
                    type="text"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="e.g. 2 years / Fresher"
                    className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Current Salary (₹) *</label>
                  <input
                    type="text"
                    value={currentSalary}
                    onChange={(e) => setCurrentSalary(e.target.value)}
                    placeholder="e.g. 15000 / Nil"
                    className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Expected Salary (₹) *</label>
                  <input
                    type="number"
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(e.target.value)}
                    placeholder="Min ₹8,000"
                    className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#777777] mb-1">Notice Period *</label>
                <input
                  type="text"
                  value={noticePeriod}
                  onChange={(e) => setNoticePeriod(e.target.value)}
                  placeholder="e.g. Immediately / 15 days"
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleGoStep2}
                  className="w-full py-3 rounded-xl bg-[#1E2D4E] text-white font-bold text-xs shadow-lg hover:bg-[#162340]"
                >
                  Continue to Questions →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-xs font-black uppercase text-[#1E2D4E] tracking-wider border-b border-[#e0ddd8] pb-2">
                Screening Questions
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-[#1E2D4E]">1. Why do you want to join BSC Exclusive? *</label>
                <textarea
                  rows={3}
                  value={q1}
                  onChange={(e) => setQ1(e.target.value)}
                  placeholder="Your response..."
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-[#1E2D4E]">2. Why should we hire you? *</label>
                <textarea
                  rows={3}
                  value={q2}
                  onChange={(e) => setQ2(e.target.value)}
                  placeholder="Your response..."
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-[#1E2D4E]">3. Comfortable working weekends/festivals? *</label>
                <select
                  value={q3}
                  onChange={(e) => setQ3(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4] font-bold"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-[#1E2D4E]">4. Value in first 90 days? *</label>
                <textarea
                  rows={3}
                  value={q4}
                  onChange={(e) => setQ4(e.target.value)}
                  placeholder="Your response..."
                  className="w-full p-2.5 rounded-lg border border-[#e0ddd8] bg-[#F9F7F4]"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3 rounded-xl border border-[#e0ddd8] font-bold text-xs"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSubmit}
                  className="flex-1 py-3 rounded-xl bg-[#1E2D4E] text-white font-bold text-xs shadow-lg hover:bg-[#162340] disabled:opacity-50"
                >
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
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 rounded-xl bg-[#1E2D4E] text-white font-bold text-xs shadow-lg hover:bg-[#162340]"
                >
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
