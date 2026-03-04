import { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '../firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './ProfileScreen.css';

interface Props {
    onBack: () => void;
}

export default function ProfileScreen({ onBack }: Props) {
    const [displayName, setDisplayName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [gender, setGender] = useState('male');
    const [bio, setBio] = useState('');
    const [country, setCountry] = useState('SA');
    const [avatarSeed, setAvatarSeed] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const avatarOptions = [
        'avataaars', 'adventurer', 'bottts', 'croodles',
        'fun-emoji', 'identicon', 'initials', 'lorelei',
        'micah', 'miniavs', 'notionists', 'open-peeps',
        'personas', 'pixel-art', 'rings'
    ];

    useEffect(() => {
        const loadUserData = async () => {
            if (auth.currentUser) {
                setDisplayName(auth.currentUser.displayName || '');
                setPhotoURL(auth.currentUser.photoURL || '');
                setAvatarSeed(auth.currentUser.displayName || 'player');

                try {
                    const docRef = doc(db, 'users', auth.currentUser.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.avatarSeed) setAvatarSeed(data.avatarSeed);
                        if (data.avatarType !== undefined) setSelectedAvatar(data.avatarType);
                        if (data.birthDate) setBirthDate(data.birthDate);
                        if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
                        if (data.gender) setGender(data.gender);
                        if (data.photoURL) setPhotoURL(data.photoURL);
                        if (data.bio) setBio(data.bio);
                        if (data.country) setCountry(data.country);
                    }
                } catch (error) {
                    console.error('Error loading user data:', error);
                }
            }
        };
        loadUserData();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !auth.currentUser) return;

        if (file.size > 2 * 1024 * 1024) {
            setMessage('⚠️ حجم الصورة كبير جداً (الأقصى 2 ميجابايت)');
            return;
        }

        setUploading(true);
        try {
            const storageRef = ref(storage, `avatars/${auth.currentUser.uid}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            setPhotoURL(downloadURL);
            setMessage('✅ تم رفع الصورة بنجاح!');
        } catch (error) {
            setMessage('❌ فشل رفع الصورة');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!auth.currentUser) {
            setMessage('⚠️ سجل الدخول أولاً لحفظ البيانات');
            return;
        }

        if (!displayName.trim()) {
            setMessage('⚠️ الاسم مطلوب لتحديث الهوية');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            // 1. Update Authentication Profile (Internal Firebase Service)
            await updateProfile(auth.currentUser, {
                displayName: displayName.trim(),
                photoURL: photoURL
            });

            // 2. Update Official Record in Firestore (Global Database)
            const userDoc = doc(db, 'users', auth.currentUser.uid);
            const finalData = {
                displayName: displayName.trim(),
                avatarSeed: avatarSeed,
                avatarType: selectedAvatar,
                photoURL: photoURL,
                birthDate: birthDate,
                phoneNumber: phoneNumber,
                gender: gender,
                bio: bio.trim(),
                country: country,
                isProfileComplete: true, // Flag for game integrity
                updatedAt: new Date().toISOString()
            };

            await setDoc(userDoc, finalData, { merge: true });

            setMessage('✅ تم مزامنة بياناتك الرسمية مع الخادم بنجاح!');

            // Artificial delay for "Official Feel"
            setTimeout(() => {
                onBack();
            }, 2000);

        } catch (error) {
            console.error('Critical Profile Update Error:', error);
            setMessage('❌ فشل الاتصال بقاعدة البيانات. حاول مرة أخرى');
        } finally {
            setLoading(false);
        }
    };

    const generateRandomAvatar = () => {
        setPhotoURL('');
        const randomSeed = Math.random().toString(36).substring(7);
        setAvatarSeed(randomSeed);
    };

    return (
        <div className="profile-screen">
            <div className="profile-container prestige">
                <header className="profile-header">
                    <button className="back-btn" onClick={onBack}>‹</button>
                    <div className="title-group">
                        <span className="title-icon">🏛️</span>
                        <h1>السجل الرسمي للمواطن</h1>
                    </div>
                </header>

                <div className="profile-scroll-area">
                    {/* Official Avatar Section */}
                    <div className="avatar-master-section">
                        <div className="avatar-display-wrapper">
                            <div className="avatar-glow highlight"></div>
                            {photoURL ? (
                                <img src={photoURL} alt="Profile" className="avatar-main" />
                            ) : (
                                <img
                                    src={`https://api.dicebear.com/7.x/${avatarOptions[selectedAvatar]}/svg?seed=${avatarSeed}`}
                                    alt="Avatar"
                                    className="avatar-main"
                                />
                            )}

                            <div className="avatar-actions-overlay">
                                <button className="action-circle upload" onClick={() => fileInputRef.current?.click()} title="رفع هوية بصرية">
                                    📷
                                </button>
                                <button className="action-circle random" onClick={generateRandomAvatar} title="توليد رمز عشوائي">
                                    🎲
                                </button>
                            </div>
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileUpload} />
                        </div>
                        {uploading && <div className="upload-progress">جاري التشفير والرفع...</div>}
                    </div>

                    {/* Identity Details */}
                    <div className="identity-section">
                        <div className="section-title">
                            <span className="title-line"></span>
                            <h3>توثيق الهوية</h3>
                        </div>

                        <div className="profile-form">
                            <div className="form-double-col">
                                <div className="input-group">
                                    <label>الاسم الرسمي</label>
                                    <div className="input-wrapper">
                                        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="الاسم الكامل" />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label>البريد الإلكتروني</label>
                                    <div className="input-wrapper disabled">
                                        <input type="email" value={auth.currentUser?.email || ''} disabled />
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="input-group half">
                                    <label>تاريخ الميلاد</label>
                                    <div className="input-wrapper">
                                        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                                    </div>
                                </div>
                                <div className="input-group half">
                                    <label>الدولة</label>
                                    <div className="input-wrapper">
                                        <select value={country} onChange={(e) => setCountry(e.target.value)}>
                                            <option value="SA">المملكة العربية السعودية</option>
                                            <option value="KW">الكويت</option>
                                            <option value="AE">الإمارات العربية المتحدة</option>
                                            <option value="QA">قطر</option>
                                            <option value="OM">عمان</option>
                                            <option value="BH">البحرين</option>
                                            <option value="EG">مصر</option>
                                            <option value="OTHER">أخرى</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="input-group half">
                                    <label>الجنس</label>
                                    <div className="input-wrapper">
                                        <select value={gender} onChange={(e) => setGender(e.target.value)}>
                                            <option value="male">ذكر</option>
                                            <option value="female">أنثى</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="input-group half">
                                    <label>رقم التواصل</label>
                                    <div className="input-wrapper">
                                        <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+XXXXXXXXXXXX" />
                                    </div>
                                </div>
                            </div>

                            <div className="input-group">
                                <label>نبذة تعريفية (ستظهر للاعبين)</label>
                                <div className="input-wrapper textarea-mode">
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="اكتب شيئاً عن مهارتك في البصرة..."
                                        maxLength={150}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div className={`status-message ${message.includes('✅') ? 'success' : 'error'}`}>
                            {message}
                        </div>
                    )}

                    <div className="profile-footer">
                        <button className="prestige-save-btn official-lock" onClick={handleSave} disabled={loading || uploading}>
                            <span className="lock-icon">{loading ? '⌛' : '🔒'}</span>
                            <span>{loading ? 'جاري مزامنة السجل...' : 'توثيق وحفظ السجل الرسمي'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
