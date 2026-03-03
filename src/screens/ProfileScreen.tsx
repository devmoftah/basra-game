import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import './ProfileScreen.css';

interface Props {
    onBack: () => void;
}

export default function ProfileScreen({ onBack }: Props) {
    const [displayName, setDisplayName] = useState('');
    const [avatarSeed, setAvatarSeed] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(0);

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
                setAvatarSeed(auth.currentUser.displayName || 'player');
                
                // Load saved avatar preference
                try {
                    const docRef = doc(db, 'users', auth.currentUser.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.avatarSeed) {
                            setAvatarSeed(data.avatarSeed);
                        }
                        if (data.avatarType !== undefined) {
                            setSelectedAvatar(data.avatarType);
                        }
                    }
                } catch (error) {
                    console.error('Error loading user data:', error);
                }
            }
        };
        loadUserData();
    }, []);

    const handleSave = async () => {
        if (!auth.currentUser || !displayName.trim()) {
            setMessage('⚠️ الاسم لا يمكن أن يكون فارغاً');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            // Update display name in Firestore (since updateProfile might not be available)
            const userDoc = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userDoc, {
                displayName: displayName.trim(),
                avatarSeed: avatarSeed,
                avatarType: selectedAvatar,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            setMessage('✅ تم حفظ التغييرات بنجاح!');
            
            // Update room display name if needed
            setTimeout(() => {
                onBack();
            }, 1500);
            
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage('❌ حدث خطأ أثناء حفظ التغييرات');
        } finally {
            setLoading(false);
        }
    };

    const generateRandomAvatar = () => {
        const randomSeed = Math.random().toString(36).substring(7);
        setAvatarSeed(randomSeed);
    };

    return (
        <div className="profile-screen">
            <div className="profile-container">
                <header className="profile-header">
                    <button className="back-btn" onClick={onBack}>←</button>
                    <h1>الملف الشخصي</h1>
                </header>

                <div className="profile-content">
                    <div className="avatar-section">
                        <h3>الصورة الشخصية</h3>
                        <div className="avatar-preview">
                            <img 
                                src={`https://api.dicebear.com/7.x/${avatarOptions[selectedAvatar]}/svg?seed=${avatarSeed}`}
                                alt="Avatar" 
                                className="avatar-large"
                            />
                        </div>
                        
                        <div className="avatar-controls">
                            <button 
                                className="random-avatar-btn"
                                onClick={generateRandomAvatar}
                            >
                                🎲 صورة عشوائية
                            </button>
                        </div>

                        <div className="avatar-styles">
                            <h4>نمط الصورة:</h4>
                            <div className="avatar-grid">
                                {avatarOptions.map((style, index) => (
                                    <button
                                        key={style}
                                        className={`avatar-style-btn ${selectedAvatar === index ? 'active' : ''}`}
                                        onClick={() => setSelectedAvatar(index)}
                                    >
                                        <img 
                                            src={`https://api.dicebear.com/7.x/${style}/svg?seed=${avatarSeed}`}
                                            alt={style}
                                            className="avatar-small"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="info-section">
                        <h3>المعلومات الشخصية</h3>
                        <div className="form-group">
                            <label htmlFor="displayName">الاسم:</label>
                            <input
                                id="displayName"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="أدخل اسمك"
                                maxLength={20}
                                className="name-input"
                            />
                            <small>{displayName.length}/20 حرف</small>
                        </div>

                        <div className="form-group">
                            <label>البريد الإلكتروني:</label>
                            <input
                                type="email"
                                value={auth.currentUser?.email || ''}
                                disabled
                                className="email-input"
                            />
                            <small>لا يمكن تغيير البريد الإلكتروني</small>
                        </div>
                    </div>

                    {message && (
                        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
                            {message}
                        </div>
                    )}

                    <div className="profile-actions">
                        <button 
                            className="save-btn"
                            onClick={handleSave}
                            disabled={loading}
                        >
                            {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
