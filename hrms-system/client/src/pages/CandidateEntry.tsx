import React, { useState, useEffect, useRef } from 'react';
import { API } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import { optimizeFile } from '../utils/fileOptimizer';
import { 
  User, Phone, Mail, MapPin, Calendar, Briefcase, Award, 
  FileText, ShieldCheck, CheckCircle2, Upload, Sparkles, ArrowRight, ArrowLeft, 
  Image as ImageIcon, FileCheck, Camera, RefreshCw, X, Check, AlertCircle, Eye, Zap, Save, RotateCcw
} from 'lucide-react';

const DRAFT_KEY = 'bsc_candidate_entry_draft_v4';

// ── Live Camera Modal Component ──────────────────────────────────────────────
interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title: string;
  defaultFacingMode?: 'user' | 'environment';
}

function CameraModal({ isOpen, onClose, onCapture, title, defaultFacingMode = 'user' }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(defaultFacingMode);
  const [isInitializing, setIsInitializing] = useState(true);

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    setIsInitializing(true);
    setCameraError('');
    stopStream();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setCameraError('Unable to access device camera. Please grant permission or choose a file from your device instead.');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (isOpen && !capturedDataUrl) {
      startCamera(facingMode);
    } else if (!isOpen) {
      stopStream();
      setCapturedDataUrl(null);
      setCameraError('');
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedDataUrl(dataUrl);
      stopStream();
    }
  };

  const handleConfirmPhoto = () => {
    if (!capturedDataUrl) return;
    try {
      const arr = capturedDataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const fileName = `camera_photo_${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });
      onCapture(file);
      onClose();
    } catch (e: any) {
      showToast('Error processing captured photo', 'error');
    }
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
    startCamera(facingMode);
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-4 animate-scale-in border border-white/20">
        <div className="bg-[#1E2D4E] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-sm">
            <Camera className="w-5 h-5 text-[#C9952A]" />
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {cameraError ? (
            <div className="p-6 text-center space-y-3 bg-rose-50 rounded-2xl border border-rose-200 text-rose-900">
              <AlertCircle className="w-10 h-10 mx-auto text-rose-600" />
              <p className="text-xs font-bold leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-md"
              >
                Close &amp; Choose File Upload
              </button>
            </div>
          ) : capturedDataUrl ? (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-inner">
                <img src={capturedDataUrl} alt="Captured preview" className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 py-3 px-4 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] hover:bg-white transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 text-[#C9952A]" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPhoto}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Use Photo</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-inner flex items-center justify-center">
                {isInitializing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-white text-xs font-bold gap-2.5 z-10">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#C9952A]" />
                    <span>Opening Camera Stream...</span>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="px-4 py-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] hover:bg-white transition-colors flex items-center gap-2"
                  title="Switch between front and back camera"
                >
                  <RefreshCw className="w-4 h-4 text-[#C9952A]" />
                  <span className="hidden sm:inline">Flip Camera</span>
                </button>

                <button
                  type="button"
                  onClick={handleTakeSnapshot}
                  disabled={isInitializing}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#1E2D4E] text-white text-xs font-extrabold hover:bg-[#162340] transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 text-[#C9952A]" />
                  <span>Capture Snapshot</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────
export default function CandidateEntryPage() {
  const [step, setStep] = useState(1);
  const [designations, setDesignations] = useState<string[]>([]);
  const [dupWarn, setDupWarn] = useState('');
  const [dupCandidateData, setDupCandidateData] = useState<any>(null);
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
  const [religion, setReligion] = useState('');
  const [caste, setCaste] = useState('');
  const [languagesKnown, setLanguagesKnown] = useState<string[]>([]);
  const [previousSalary, setPreviousSalary] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');

  // Files
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [existingResume, setExistingResume] = useState('');
  const [existingPhoto, setExistingPhoto] = useState('');
  const [existingAadhaar, setExistingAadhaar] = useState('');

  const [declaration, setDeclaration] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Submitting Registration...');
  const [successAppNo, setSuccessAppNo] = useState('');

  // Draft Restoration Notification State
  const [restoredDraftInfo, setRestoredDraftInfo] = useState<{ name: string; step: number; time: string } | null>(null);

  // Camera Modal State
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraModalTitle, setCameraModalTitle] = useState('Take Candidate Photo');
  const [cameraTarget, setCameraTarget] = useState<'photo' | 'aadhaar' | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');

  // Input refs for file triggers
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoCameraInputRef = useRef<HTMLInputElement | null>(null);
  const aadhaarInputRef = useRef<HTMLInputElement | null>(null);
  const aadhaarCameraInputRef = useRef<HTMLInputElement | null>(null);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);

  // Helper to format Aadhaar input with spaces: 1234 5678 9012
  const formatAadhaar = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  // Clear all form state and start fresh
  const handleClearDraftAndStartFresh = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (e) {}

    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setGender('');
    setBloodGroup('');
    setDob('');
    setOfferedDoj('');
    setDesig('');
    setQualification('');
    setExperience('');
    setRetailExperience('');
    setPreviousCompany('');
    setPreviousDesignation('');
    setAadhaarNumber('');
    setFatherDetails('');
    setMotherDetails('');
    setReligion('');
    setCaste('');
    setLanguagesKnown([]);
    setPreviousSalary('');
    setExpectedSalary('');
    setDeclaration(false);
    setPhotoFile(null);
    setAadhaarFile(null);
    setResumeFile(null);
    setPhotoPreview(null);
    setDupWarn('');
    setDupCandidateData(null);
    setRestoredDraftInfo(null);
    setStep(1);
    showToast('Cleared saved draft. You can start fresh!', 'info');
  };



  // Populate candidate data from duplicate lookup or previous candidate record
  const populateCandidateRecord = (c: any) => {
    if (!c) return;
    if (c.name) setName(c.name);
    if (c.email) setEmail(c.email);
    if (c.phone) setPhone(c.phone);
    if (c.address) setAddress(c.address);
    if (c.gender) setGender(c.gender);
    if (c.bloodGroup) setBloodGroup(c.bloodGroup);
    if (c.dob) setDob(c.dob.split('T')[0]);
    if (c.offeredDoj) setOfferedDoj(c.offeredDoj.split('T')[0]);
    if (c.desig) setDesig(c.desig);
    if (c.qualification) setQualification(c.qualification);
    if (c.experience) setExperience(c.experience);
    if (c.retailExperience) setRetailExperience(c.retailExperience);
    if (c.previousCompany) setPreviousCompany(c.previousCompany);
    if (c.previousDesignation) setPreviousDesignation(c.previousDesignation);
    if (c.previousSalary || c.currentSalary || c.current_salary) setPreviousSalary(c.previousSalary || c.currentSalary || c.current_salary);
    if (c.expectedSalary || c.expected_salary) setExpectedSalary(c.expectedSalary || c.expected_salary);
    if (c.aadhaarNumber) setAadhaarNumber(formatAadhaar(c.aadhaarNumber));
    if (c.fatherDetails) setFatherDetails(c.fatherDetails);
    if (c.motherDetails) setMotherDetails(c.motherDetails);
    if (c.religionCaste) {
      const parts = c.religionCaste.split(' / ');
      setReligion(parts[0] || c.religionCaste);
      setCaste(parts[1] || '');
    }
    if (c.languagesKnown) {
      setLanguagesKnown(typeof c.languagesKnown === 'string' ? (c.languagesKnown.startsWith('[') ? JSON.parse(c.languagesKnown) : [c.languagesKnown]) : c.languagesKnown);
    }
    if (c.resumeUrl) setExistingResume(c.resumeUrl);
    if (c.photoUrl) setExistingPhoto(c.photoUrl);
    if (c.aadharUrl || c.aadhaarUrl) setExistingAadhaar(c.aadharUrl || c.aadhaarUrl);

    showToast(`⚡ Auto-filled previous registration data for ${c.name}!`, 'success');
  };

  // Restore Draft on initial load (Dual localStorage + sessionStorage check)
  useEffect(() => {
    API.getPublicDesignations().then(res => {
      if (res && res.designations) setDesignations(res.designations);
    }).catch(() => {});

    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');

    if (editId) {
      setEditAppNo(editId);
      setLoading(true);
      API.call('getCandidates', { appNo: editId }).then(res => {
        if (res.candidates && res.candidates.length > 0) {
          populateCandidateRecord(res.candidates[0]);
          setDeclaration(true);
        }
        setLoading(false);
      }).catch(err => {
        showToast('Failed to load candidate data', 'error');
        setLoading(false);
      });
    } else {
      // Restore persistent draft from localStorage or sessionStorage
      try {
        const rawSaved = localStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(DRAFT_KEY);
        if (rawSaved) {
          const d = JSON.parse(rawSaved);
          if (d.name || d.phone || d.address) {
            if (d.name) setName(d.name);
            if (d.email) setEmail(d.email);
            if (d.phone) setPhone(d.phone);
            if (d.address) setAddress(d.address);
            if (d.gender) setGender(d.gender);
            if (d.bloodGroup) setBloodGroup(d.bloodGroup);
            if (d.dob) setDob(d.dob);
            if (d.offeredDoj) setOfferedDoj(d.offeredDoj);
            if (d.desig) setDesig(d.desig);
            if (d.qualification) setQualification(d.qualification);
            if (d.experience) setExperience(d.experience);
            if (d.retailExperience) setRetailExperience(d.retailExperience);
            if (d.previousCompany) setPreviousCompany(d.previousCompany);
            if (d.previousDesignation) setPreviousDesignation(d.previousDesignation);
            if (d.aadhaarNumber) setAadhaarNumber(formatAadhaar(d.aadhaarNumber));
            if (d.fatherDetails) setFatherDetails(d.fatherDetails);
            if (d.motherDetails) setMotherDetails(d.motherDetails);
            if (d.religion) setReligion(d.religion);
            if (d.caste) setCaste(d.caste);
            if (d.languagesKnown) setLanguagesKnown(d.languagesKnown);
            if (d.previousSalary) setPreviousSalary(d.previousSalary);
            if (d.expectedSalary) setExpectedSalary(d.expectedSalary);
            if (d.declaration) setDeclaration(d.declaration);
            if (d.photoPreview) setPhotoPreview(d.photoPreview);
            if (d.step === 1 || d.step === 2) setStep(d.step);

            const timeStr = d.savedAt ? new Date(d.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently';
            setRestoredDraftInfo({ name: d.name || 'Candidate', step: d.step || 1, time: timeStr });
          }
        }
      } catch (e) {}
    }
  }, []);

  // Persistent Draft Auto-Save to localStorage & sessionStorage
  useEffect(() => {
    if (step === 3 || editAppNo) return;
    const draftData = {
      step, name, email, phone, address, gender, bloodGroup, dob, offeredDoj,
      desig, qualification, experience, retailExperience, previousCompany,
      previousDesignation, aadhaarNumber, fatherDetails, motherDetails,
      religion, caste, languagesKnown, previousSalary, expectedSalary, declaration, photoPreview,
      savedAt: Date.now()
    };
    try {
      const str = JSON.stringify(draftData);
      localStorage.setItem(DRAFT_KEY, str);
      sessionStorage.setItem(DRAFT_KEY, str);
    } catch (e) {}
  }, [
    step, name, email, phone, address, gender, bloodGroup, dob, offeredDoj,
    desig, qualification, experience, retailExperience, previousCompany,
    previousDesignation, aadhaarNumber, fatherDetails, motherDetails,
    religion, caste, languagesKnown, previousSalary, expectedSalary, declaration, photoPreview, editAppNo
  ]);

  // Handle Photo selection & create preview
  const handlePhotoSelect = (file: File | null) => {
    setPhotoFile(file);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  };

  // Check duplicate phone & fetch previous candidate details for instant auto-fill
  const checkDuplicate = async (ph: string) => {
    const cleanPh = ph.replace(/\D/g, '');
    if (cleanPh.length < 10) {
      setDupWarn('');
      setDupCandidateData(null);
      return;
    }
    try {
      const d = await API.checkDuplicate(cleanPh);
      if (d.exists) {
        setDupWarn(`⚠️ This phone number was registered by ${d.name} (${d.appNo}, applied ${d.appliedOn}).`);
        // Fetch full candidate record for instant auto-fill option
        API.call('getCandidates', { phone: cleanPh }).then(res => {
          if (res.candidates && res.candidates.length > 0) {
            setDupCandidateData(res.candidates[0]);
          }
        }).catch(() => {});
      } else {
        setDupWarn('');
        setDupCandidateData(null);
      }
    } catch (e) {}
  };

  const handleLangToggle = (lang: string) => {
    setLanguagesKnown(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const handleGoStep2 = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');

    if (!name.trim() || !phone.trim() || !dob || !gender || !address.trim() || !desig || !qualification || !experience || !cleanAadhaar || !bloodGroup || !religion || !caste.trim()) {
      showToast('Please fill out all mandatory fields marked with (*)', 'error');
      return;
    }
    if (cleanAadhaar.length !== 12) {
      showToast('Aadhaar number must be exactly 12 digits', 'error');
      return;
    }
    setStep(2);
    window.scrollTo(0, 0);
  };

  // Trigger Live Camera Modal
  const openCamera = (target: 'photo' | 'aadhaar', mode: 'user' | 'environment' = 'user') => {
    setCameraTarget(target);
    setCameraFacingMode(mode);
    setCameraModalTitle(target === 'photo' ? 'Take Passport Photo' : 'Snap Aadhaar Document');
    setCameraModalOpen(true);
  };

  const handleCameraCapture = (file: File) => {
    if (cameraTarget === 'photo') {
      handlePhotoSelect(file);
      showToast('Candidate photo captured successfully!', 'success');
    } else if (cameraTarget === 'aadhaar') {
      setAadhaarFile(file);
      showToast('Aadhaar document captured successfully!', 'success');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!declaration) {
      showToast('You must agree to the declaration', 'error');
      return;
    }
    if (!editAppNo && (!resumeFile || !photoFile || !aadhaarFile)) {
      showToast('Please upload all mandatory documents', 'error');
      return;
    }

    setLoading(true);
    setLoadingText('Optimizing documents under 1000 KB...');

    try {
      let resumeUrl = existingResume;
      let photoUrl = existingPhoto;
      let aadhaarUrl = existingAadhaar;

      let targetAppNo = editAppNo;
      if (!targetAppNo) {
        const genRes = await API.getNextAppNo();
        targetAppNo = genRes.appNo;
      }

      if (resumeFile || photoFile || aadhaarFile) {
        const formData = new FormData();
        if (name) formData.append('name', name);
        
        try {
          if (resumeFile) {
            setLoadingText('Optimizing Resume document...');
            const optimizedResume = await optimizeFile(resumeFile, 'Resume');
            formData.append('resume', optimizedResume);
          }
          if (photoFile) {
            setLoadingText('Optimizing Candidate Photo...');
            const optimizedPhoto = await optimizeFile(photoFile, 'Candidate Photo');
            formData.append('photo', optimizedPhoto);
          }
          if (aadhaarFile) {
            setLoadingText('Optimizing Aadhaar Document...');
            const optimizedAadhaar = await optimizeFile(aadhaarFile, 'Aadhaar Document');
            formData.append('aadhar', optimizedAadhaar);
          }
        } catch (optimizationError: any) {
          showToast(optimizationError.message || 'File optimization failed.', 'error');
          setLoading(false);
          return;
        }
        
        setLoadingText('Uploading files to server...');
        const uploadRes = await API.uploadDocuments(formData, name, targetAppNo);
        if (uploadRes.success) {
          if (uploadRes.resumeUrl) resumeUrl = uploadRes.resumeUrl;
          if (uploadRes.photoUrl) photoUrl = uploadRes.photoUrl;
          if (uploadRes.aadhaarUrl) aadhaarUrl = uploadRes.aadhaarUrl;
        }
      }

      setLoadingText('Finalizing Candidate Registration...');
      const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
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
        previousSalary,
        expectedSalary,
        aadhaarNumber: cleanAadhaar,
        fatherDetails,
        motherDetails,
        religion,
        caste,
        religionCaste: religion && caste ? `${religion} / ${caste}` : (religion || caste || ''),
        languagesKnown,
        resumeUrl,
        photoUrl,
        aadhaarUrl,
 source: 'Walk-in',
        status: 'New'
      };

      if (editAppNo) {
        await API.call('updateCandidateFull', { appNo: targetAppNo, ...payload });
        showToast('Registration details updated successfully!', 'success');
        setSuccessAppNo(targetAppNo);
      } else {
        const res = await API.addCandidate({ appNo: targetAppNo, ...payload });
        setSuccessAppNo(res.appNo || targetAppNo);
        showToast(`Registration Successful! App No: ${res.appNo || targetAppNo}`, 'success');
      }

      // Clear draft on completion
      try {
        localStorage.removeItem(DRAFT_KEY);
        sessionStorage.removeItem(DRAFT_KEY);
      } catch (e) {}

      setStep(3);
      window.scrollTo(0, 0);
    } catch (err: any) {
      showToast('Error submitting registration: ' + (err.message || 'Server error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const defaultPositions = ['Sales Executive', 'Cashier', 'Billing Executive', 'HR', 'Store Assistant', 'Stock Executive', 'Visual Merchandiser', 'Floor Manager', 'Security', 'Housekeeping', 'Helper', 'Other'];
  const POSITIONS = Array.from(new Set([...(designations || []), ...defaultPositions])).filter(Boolean);
  const QUALIFICATIONS = ['SSLC', 'PUC', 'Diploma', 'Graduate', 'Other'];
  const EXP_LEVELS = ['Fresher', 'Less than 1 Year', '1–2 Years', '2–5 Years', 'More than 5 Years'];
  const LANGUAGES = ['Kannada', 'English', 'Hindi', 'Telugu', 'Tamil', 'Marathi', 'Others'];

  // Suggestion Chips Data
  const CITY_SUGGESTIONS = ['Bangalore', 'Mysore', 'Tumkur', 'Mandya', 'Hassan', 'Davangere', 'Hubli', 'Belgaum', 'Chitradurga'];
  const RELIGION_SUGGESTIONS = ['Hindu', 'Muslim', 'Christian', 'Jain', 'Sikh', 'Buddhist'];
  const CASTE_SUGGESTIONS = ['General / GM', 'OBC', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B'];

  return (
    <div className="min-h-screen bg-[#EDE8DE] pb-12">
      <ToastContainer />

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        title={cameraModalTitle}
        defaultFacingMode={cameraFacingMode}
      />

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
        {/* Restored Draft Auto-Recovery Banner */}
        {restoredDraftInfo && step !== 3 && (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black flex-shrink-0 shadow-sm">
                <Save className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs text-[#1E2D4E]">
                  Form Restored From Your Previous Session!
                </div>
                <div className="text-[11px] text-[#555555] font-semibold">
                  Continuing draft for <span className="font-bold text-[#1E2D4E]">{restoredDraftInfo.name}</span> (Step {restoredDraftInfo.step}, saved {restoredDraftInfo.time}).
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleClearDraftAndStartFresh}
                className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-amber-900 text-xs font-extrabold hover:bg-amber-100 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Start Fresh</span>
              </button>
              <button
                type="button"
                onClick={() => setRestoredDraftInfo(null)}
                className="px-3 py-1.5 rounded-xl bg-[#1E2D4E] text-white text-xs font-extrabold hover:bg-[#162340] transition-colors"
              >
                Continue Entry
              </button>
            </div>
          </div>
        )}

        {/* Step Stepper Indicator */}
        {step !== 3 && (
          <div className="card-glass p-4 text-xs font-extrabold space-y-2">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${step === 1 ? 'text-[#1E2D4E]' : 'text-emerald-700'}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${step === 1 ? 'bg-[#1E2D4E] text-white shadow-md ring-2 ring-[#C9952A]' : 'bg-emerald-600 text-white'}`}>
                  {step > 1 ? '✓' : '1'}
                </span>
                <span className="hidden sm:inline">Step 1: Personal &amp; Career Info</span>
                <span className="sm:hidden">Step 1</span>
              </div>

              <div className={`flex items-center gap-2 ${step === 2 ? 'text-[#1E2D4E]' : 'text-[#888888]'}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${step === 2 ? 'bg-[#1E2D4E] text-white shadow-md ring-2 ring-[#C9952A]' : 'bg-[#F9F7F4] border border-[#e2dfd7]'}`}>
                  2
                </span>
                <span className="hidden sm:inline">Step 2: Documents &amp; Declaration</span>
                <span className="sm:hidden">Step 2</span>
              </div>
            </div>

            {/* Animated Progress Bar Line */}
            <div className="h-1.5 w-full bg-[#e2dfd7] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1E2D4E] to-[#C9952A] transition-all duration-500 ease-out"
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>
          </div>
        )}

        {/* STEP 1 FORM */}
        {step === 1 && (
          <form onSubmit={handleGoStep2} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            {/* Section 1: Personal Details */}
            <div className="space-y-4">
              <div className="border-b border-[#e2dfd7] pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-[#C9952A]" />
                  <h2 className="text-sm font-extrabold uppercase text-[#1E2D4E] tracking-wider">
                    1. Personal &amp; Contact Details
                  </h2>
                </div>


              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Full Name (As per Aadhaar) *</label>
                  <input
                    type="text"
                    autoComplete="name"
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
                      autoComplete="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); checkDuplicate(e.target.value); }}
                      placeholder="10-digit mobile number"
                      className="input-modern rounded-l-none"
                    />
                  </div>
                  
                  {/* Duplicate Phone Notice with Instant Auto-Fill Option */}
                  {dupWarn && (
                    <div className="p-3 mt-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold space-y-2">
                      <div>{dupWarn}</div>
                      {dupCandidateData && (
                        <button
                          type="button"
                          onClick={() => populateCandidateRecord(dupCandidateData)}
                          className="px-3 py-1.5 rounded-lg bg-[#1E2D4E] text-white text-xs font-extrabold hover:bg-[#162340] transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <Zap className="w-3.5 h-3.5 text-[#C9952A]" />
                          <span>⚡ Auto-Fill From Previous Registration</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    autoComplete="email"
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
                    autoComplete="bday"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Blood Group *</label>
                  <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="select-modern">
                    <option value="">Select Blood Group</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not Known'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#1E2D4E]">Complete Residential Address *</label>
                  <span className="text-[10px] text-[#777777] font-semibold">Auto-fill suggestions:</span>
                </div>

                <textarea
                  rows={2}
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House No, Street, Area, City, Pin Code"
                  className="textarea-modern mb-2"
                />

                {/* City Suggestion Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] font-bold text-[#777777] flex items-center gap-1 mr-1">
                    <MapPin className="w-3 h-3 text-[#C9952A]" />
                    <span>Quick Cities:</span>
                  </span>
                  {CITY_SUGGESTIONS.map(city => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setAddress(prev => prev ? (prev.includes(city) ? prev : `${prev}, ${city}`) : city)}
                      className="px-2 py-0.5 rounded-lg bg-[#F9F7F4] border border-[#e2dfd7] text-[10.5px] font-bold text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-colors"
                    >
                      + {city}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Aadhaar Number (12 Digits) *</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={aadhaarNumber}
                    onChange={(e) => setAadhaarNumber(formatAadhaar(e.target.value))}
                    placeholder="1234 5678 9012"
                    className="input-modern tracking-wider font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Religion *</label>
                  <select value={religion} onChange={(e) => setReligion(e.target.value)} className="select-modern">
                    <option value="">Select Religion</option>
                    {RELIGION_SUGGESTIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  {/* Religion Suggestions */}
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {RELIGION_SUGGESTIONS.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReligion(r)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${religion === r ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' : 'bg-[#F9F7F4] border-[#e2dfd7] text-[#555555] hover:bg-white'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Caste / Category *</label>
                  <input
                    type="text"
                    value={caste}
                    onChange={(e) => setCaste(e.target.value)}
                    placeholder="e.g. General, OBC, SC, ST, Cat-1, 2A, 3B..."
                    className="input-modern"
                  />
                  {/* Category Suggestions */}
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {CASTE_SUGGESTIONS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCaste(c)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${caste === c ? 'bg-[#1E2D4E] text-white border-[#1E2D4E]' : 'bg-[#F9F7F4] border-[#e2dfd7] text-[#555555] hover:bg-white'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Father's Name &amp; Occupation (Optional)</label>
                  <input
                    type="text"
                    value={fatherDetails}
                    onChange={(e) => setFatherDetails(e.target.value)}
                    placeholder="Father details"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Mother's Name &amp; Occupation (Optional)</label>
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
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Earliest Date of Joining (Earliest Availability)</label>
                  <input
                    type="date"
                    value={offeredDoj}
                    onChange={(e) => setOfferedDoj(e.target.value)}
                    className="input-modern"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1E2D4E]">Prior work experience? *</label>
                <div className="space-y-2">
                  {[
                    'Yes, in a clothing/apparel store',
                    'Yes, in another type of retail store',
                    'Worked but not in the retail field',
                    'No, fresher / no prior work experience'
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

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Previous Salary (₹ Monthly)</label>
                  <input
                    type="text"
                    value={previousSalary}
                    onChange={(e) => setPreviousSalary(e.target.value)}
                    placeholder="e.g. 18000"
                    className="input-modern font-bold text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Expected Salary (₹ Monthly)</label>
                  <input
                    type="text"
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(e.target.value)}
                    placeholder="e.g. 22000"
                    className="input-modern font-bold text-emerald-800"
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
          </form>
        )}

        {/* STEP 2 FORM */}
        {step === 2 && (
          <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-[#e2dfd7] pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#C9952A]" />
                <h2 className="text-sm font-extrabold uppercase text-[#1E2D4E] tracking-wider">
                  3. Mandatory Document Uploads &amp; Declaration
                </h2>
              </div>
              <span className="text-[11px] font-extrabold text-[#C9952A] bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                Max file limit: 1000 KB (1 MB)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 1. Candidate Passport Photo */}
              <div className="p-5 rounded-2xl border-2 border-dashed border-[#e2dfd7] bg-[#F9F7F4] space-y-3 hover:border-[#1E2D4E] transition-all flex flex-col justify-between">
                <div className="space-y-2 text-center">
                  {photoPreview ? (
                    <div className="w-20 h-20 mx-auto rounded-xl overflow-hidden border-2 border-[#1E2D4E] shadow-md relative group">
                      <img src={photoPreview} alt="Candidate Photo" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => { handlePhotoSelect(null); setPhotoPreview(null); }}
                          className="p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700"
                          title="Remove photo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ImageIcon className="w-10 h-10 text-[#C9952A] mx-auto" />
                  )}
                  
                  <div>
                    <div className="font-extrabold text-xs text-[#1E2D4E]">Candidate Photo *</div>
                    <div className="text-[10px] text-[#777777] font-semibold mt-0.5">JPG, PNG up to 1000 KB</div>
                  </div>

                  {photoFile && (
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold truncate">
                      ✓ {photoFile.name} ({(photoFile.size / 1024).toFixed(0)} KB)
                    </div>
                  )}
                </div>

                {/* Multiple Upload Options */}
                <div className="space-y-2 pt-2 border-t border-[#e2dfd7]">
                  {/* Option 1: Live Web Camera */}
                  <button
                    type="button"
                    onClick={() => openCamera('photo', 'user')}
                    className="w-full py-2 px-3 rounded-xl bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#162340] transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4 text-[#C9952A]" />
                    <span>Take Live Photo</span>
                  </button>

                  {/* Option 2: Browse Device Gallery */}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoSelect(e.target.files ? e.target.files[0] : null)}
                    className="hidden"
                    ref={photoInputRef}
                    id="photo-input"
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose File / Gallery</span>
                  </button>

                  {/* Option 3: Direct Mobile Camera */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={(e) => handlePhotoSelect(e.target.files ? e.target.files[0] : null)}
                    className="hidden"
                    ref={photoCameraInputRef}
                  />
                  <button
                    type="button"
                    onClick={() => photoCameraInputRef.current?.click()}
                    className="w-full py-1.5 px-2 rounded-lg bg-transparent text-[10.5px] font-bold text-[#777777] hover:text-[#1E2D4E] transition-colors flex items-center justify-center gap-1"
                  >
                    <span>📱 Use Mobile Device Camera</span>
                  </button>
                </div>
              </div>

              {/* 2. Aadhaar Card Document */}
              <div className="p-5 rounded-2xl border-2 border-dashed border-[#e2dfd7] bg-[#F9F7F4] space-y-3 hover:border-[#1E2D4E] transition-all flex flex-col justify-between">
                <div className="space-y-2 text-center">
                  <FileCheck className="w-10 h-10 text-[#C9952A] mx-auto" />
                  
                  <div>
                    <div className="font-extrabold text-xs text-[#1E2D4E]">Aadhaar Document *</div>
                    <div className="text-[10px] text-[#777777] font-semibold mt-0.5">Photo or PDF up to 1000 KB</div>
                  </div>

                  {aadhaarFile ? (
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold truncate">
                      ✓ {aadhaarFile.name} ({(aadhaarFile.size / 1024).toFixed(0)} KB)
                    </div>
                  ) : existingAadhaar ? (
                    <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold truncate">
                      Existing Aadhaar Attached
                    </div>
                  ) : null}
                </div>

                {/* Multiple Upload Options */}
                <div className="space-y-2 pt-2 border-t border-[#e2dfd7]">
                  {/* Option 1: Snap Document Camera */}
                  <button
                    type="button"
                    onClick={() => openCamera('aadhaar', 'environment')}
                    className="w-full py-2 px-3 rounded-xl bg-[#1E2D4E] text-white text-xs font-bold hover:bg-[#162340] transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4 text-[#C9952A]" />
                    <span>Snap Aadhaar Photo</span>
                  </button>

                  {/* Option 2: Upload Document File / PDF */}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setAadhaarFile(e.target.files ? e.target.files[0] : null)}
                    className="hidden"
                    ref={aadhaarInputRef}
                  />
                  <button
                    type="button"
                    onClick={() => aadhaarInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose File / PDF</span>
                  </button>

                  {/* Option 3: Direct Mobile Camera Snap */}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={(e) => setAadhaarFile(e.target.files ? e.target.files[0] : null)}
                    className="hidden"
                    ref={aadhaarCameraInputRef}
                  />
                  <button
                    type="button"
                    onClick={() => aadhaarCameraInputRef.current?.click()}
                    className="w-full py-1.5 px-2 rounded-lg bg-transparent text-[10.5px] font-bold text-[#777777] hover:text-[#1E2D4E] transition-colors flex items-center justify-center gap-1"
                  >
                    <span>📱 Snap via Mobile Camera</span>
                  </button>
                </div>
              </div>

              {/* 3. Resume / CV Document */}
              <div className="p-5 rounded-2xl border-2 border-dashed border-[#e2dfd7] bg-[#F9F7F4] space-y-3 hover:border-[#1E2D4E] transition-all flex flex-col justify-between">
                <div className="space-y-2 text-center">
                  <FileText className="w-10 h-10 text-[#C9952A] mx-auto" />
                  
                  <div>
                    <div className="font-extrabold text-xs text-[#1E2D4E]">Resume / CV Document *</div>
                    <div className="text-[10px] text-[#777777] font-semibold mt-0.5">PDF, DOC, DOCX up to 1000 KB</div>
                  </div>

                  {resumeFile ? (
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold truncate">
                      ✓ {resumeFile.name} ({(resumeFile.size / 1024).toFixed(0)} KB)
                    </div>
                  ) : existingResume ? (
                    <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold truncate">
                      Existing Resume Attached
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 pt-2 border-t border-[#e2dfd7]">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={(e) => setResumeFile(e.target.files ? e.target.files[0] : null)}
                    className="hidden"
                    ref={resumeInputRef}
                  />
                  <button
                    type="button"
                    onClick={() => resumeInputRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-xl bg-white border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Upload className="w-4 h-4 text-[#C9952A]" />
                    <span>Choose Resume File</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Declaration Checkbox */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer text-xs font-semibold text-[#1E2D4E]">
                <input
                  type="checkbox"
                  checked={declaration}
                  onChange={(e) => setDeclaration(e.target.checked)}
                  className="mt-0.5 rounded accent-[#1E2D4E] w-4 h-4 cursor-pointer"
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
                className="px-5 py-2.5 rounded-xl border border-[#e2dfd7] text-xs font-bold text-[#1E2D4E] hover:bg-[#F9F7F4] transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Step 1</span>
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-gold flex items-center gap-2 shadow-lg disabled:opacity-50 py-3 px-6 text-xs font-extrabold"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{loadingText}</span>
                  </span>
                ) : (
                  <>
                    <span>Complete Candidate Registration</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
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
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem(DRAFT_KEY);
                    sessionStorage.removeItem(DRAFT_KEY);
                  } catch (e) {}
                  window.location.href = '/candidate-entry';
                }}
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
