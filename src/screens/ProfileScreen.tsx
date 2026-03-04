import { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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

        // Validations
        if (file.size > 2 * 1024 * 1024) {
            setMessage('⚠️ حجم الصورة كبير جداً (الأقصى 2 ميجابايت)');
            return;
        }

        setUploading(true);
        setMessage('');

        try {
            const storageRef = ref(storage, `avatars/${auth.currentUser.uid}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            setPhotoURL(downloadURL);
            setMessage('✅ تم رفع الصورة بنجاح!');
        } catch (error) {
            console.error('Upload error:', error);
            setMessage('❌ فشل رفع الصورة');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!auth.currentUser || !displayName.trim()) {
            setMessage('⚠️ الاسم مطلوب لتحديث الملف');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            // Update Auth Profile
            await updateProfile(auth.currentUser, {
                displayName: displayName.trim(),
                photoURL: photoURL
            });

            // Update Firestore
            const userDoc = doc(db, 'users', auth.currentUser.uid);
            await setDoc(userDoc, {
                displayName: displayName.trim(),
                avatarSeed: avatarSeed,
                avatarType: selectedAvatar,
                photoURL: photoURL,
                birthDate: birthDate,
                phoneNumber: phoneNumber,
                gender: gender,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            setMessage('✅ تم تحديث ملفك الملكي بنجاح!');

            setTimeout(() => {
                onBack();
            }, 1800);

        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage('❌ عذراً، حدث خطأ أثناء الحفظ');
        } finally {
            setLoading(false);
        }
    };

    const generateRandomAvatar = () => {
        setPhotoURL(''); // Clear custom photo when choosing avatar
        const randomSeed = Math.random().toString(36).substring(7);
        setAvatarSeed(randomSeed);
    };

    return (
        <div className="profile-screen">
            <div className="profile-container prestige">
                <header className="profile-header">
                    <button className="back-btn" onClick={onBack}>‹</button>
                    <div className="title-group">
                        <span className="title-icon">👤</span>
                        <h1>الملف الشخصي</h1>
                    </div>
                </header>

                <div className="profile-scroll-area">
                    {/* Avatar Master Section */}
                    <div className="avatar-master-section">
                        <div className="avatar-display-wrapper">
                            <div className="avatar-glow"></div>
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
                                <button className="action-circle upload" onClick={() => fileInputRef.current?.click()} title="رفع صورة">
                                    📷
                                </button>
                                <button className="action-circle random" onClick={generateRandomAvatar} title="تغيير عشوائي">
                                    🎲
                                </button>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleFileUpload}
                            />
                        </div>

                        {uploading && <div className="upload-progress">جاري الرفع...</div>}

                        {!photoURL && (
                            <div className="avatar-style-selector">
                                <p className="selector-label">اختر أسلوب الرسم الشخصي</p>
                                <div className="selector-grid">
                                    {avatarOptions.map((style, index) => (
                                        <button
                                            key={style}
                                            className={`style-pip ${selectedAvatar === index ? 'active' : ''}`}
                                            onClick={() => setSelectedAvatar(index)}
                                        >
                                            <img src={`https://api.dicebear.com/7.x/${style}/svg?seed=${avatarSeed}`} alt="" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {photoURL && (
                            <button className="use-avatar-instead" onClick={() => setPhotoURL('')}>
                                العودة لاستخدام الشخصيات الرمزية
                            </button>
                        )}
                    </div>

                    {/* Data Fields Section */}
                    <div className="identity-section">
                        <div className="section-title">
                            <span className="title-line"></span>
                            <h3>بيانات الهوية</h3>
                        </div>

                        <div className="profile-form">
                            <div className="input-group">
                                <label>الاسم</label>
                                <div className="input-wrapper">
                                    <span className="input-icon">📝</span>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="مثلاً: صقر البصرة"
                                        maxLength={25}
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label>البريد الإلكتروني (عضوية بصرة)</label>
                                <div className="input-wrapper disabled">
                                    <span className="input-icon">📧</span>
                                    <input type="email" value={auth.currentUser?.email || ''} disabled />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="input-group half">
                                    <label>تاريخ الميلاد</label>
                                    <div className="input-wrapper">
                                        <span className="input-icon">📅</span>
                                        <input
                                            type="date"
                                            value={birthDate}
                                            onChange={(e) => setBirthDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="input-group half">
                                    <label>الجنس</label>
                                    <div className="input-wrapper">
                                        <select value={gender} onChange={(e) => setGender(e.target.value)}>
                                            <option value="male">ذكر</option>
                                            <option value="female">أنثى</option>
                                            <option value="prefer_not_to_say">يفضل عدم الذكر</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="input-group">
                                <label>رقم الجوال (اختياري)</label>
                                <div className="input-wrapper">
                                    <span className="input-icon">📱</span>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="+966 5XXX XXXX"
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
                        <button
                            className="prestige-save-btn"
                            onClick={handleSave}
                            disabled={loading || uploading}
                        >
                            {loading ? 'جاري الحفظ...' : 'حفظ البيانات'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
