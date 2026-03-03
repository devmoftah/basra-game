import { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import './StoreScreen.css';

interface StoreItem {
    id: string;
    name: string;
    price: number;
    image: string;
    category: 'coins' | 'cards' | 'tables';
    isNew?: boolean;
    colors?: string[];
}

interface Props {
    onBack: () => void;
    userCoins: number;
    purchasedSkins?: string[];
}

export default function StoreScreen({ onBack, userCoins, purchasedSkins = [] }: Props) {
    const [activeTab, setActiveTab] = useState<'coins' | 'cards' | 'tables'>('coins');
    const [buying, setBuying] = useState<string | null>(null);

    const items: StoreItem[] = [
        // 🪙 COINS BUNDLES ($ USD)
        { id: 'c1', name: 'رزمة 1,000 كوينز', price: 1.99, image: '💰', category: 'coins' },
        { id: 'c2', name: 'خزنة 5,000 كوينز', price: 8.99, image: '🪙', category: 'coins', isNew: true },
        { id: 'c3', name: 'شاحنة 20,000 كوينز', price: 29.99, image: '🚛', category: 'coins' },
        { id: 'c4', name: 'بنك 50,000 كوينز', price: 69.99, image: '🏦', category: 'coins' },

        // 🃏 CARD SKINS (Libyan Clubs)
        { id: 'k1', name: 'طقم نادي دارنس', price: 400, image: '/assets/skins/cards/card_back_darnes.png', category: 'cards', colors: ['#ffd700', '#000000'] },
        { id: 'k2', name: 'طقم النادي الأفريقي', price: 400, image: '⚪🟢', category: 'cards', colors: ['#ffffff', '#00703c'] },
        { id: 'k3', name: 'طقم الأهلي طرابلس', price: 500, image: '🟢⚪', category: 'cards', colors: ['#00703c', '#ffffff'], isNew: true },
        { id: 'k4', name: 'طقم الاتحاد', price: 500, image: '🔴⚪', category: 'cards', colors: ['#cc0000', '#ffffff'] },
        { id: 'k5', name: 'طقم الأهلي بنغازي', price: 500, image: '🔴⚪', category: 'cards', colors: ['#cc0000', '#ffffff'] },
        { id: 'k6', name: 'طقم النصر', price: 500, image: '🔵⚪', category: 'cards', colors: ['#0033cc', '#ffffff'] },
        { id: 'k7', name: 'طقم نادي المدينة', price: 400, image: '⚪⚫', category: 'cards', colors: ['#ffffff', '#000000'] },

        // 🧶 TABLE SKINS
        { id: 't1', name: 'طاولة دارنس الذهبية', price: 1000, image: '🧶', category: 'tables', colors: ['#ffd700', '#111111'] },
        { id: 't2', name: 'طاولة الأفريقي الخضراء', price: 1000, image: '🧶', category: 'tables', colors: ['#00703c', '#ffffff'] },
        { id: 't3', name: 'طاولة الزعيم (الأهلي)', price: 1200, image: '🧶', category: 'tables', colors: ['#004400', '#009900'], isNew: true },
        { id: 't4', name: 'طاولة العميد (الاتحاد)', price: 1200, image: '🧶', category: 'tables', colors: ['#990000', '#ee0000'] },
    ];

    const filteredItems = items.filter(item => item.category === activeTab);

    const handleBuy = async (item: StoreItem) => {
        if (!auth.currentUser) return;
        if (item.category === 'coins') {
            alert('سيتم تفعيل نظام الدفع الحقيقي قريباً!');
            return;
        }

        if (purchasedSkins.includes(item.id)) {
            alert('أنت تملك هذا العنصر بالفعل!');
            return;
        }

        if (userCoins < item.price) {
            alert('ليس لديك كوينز كافية!');
            return;
        }

        setBuying(item.id);
        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, {
                coins: increment(-item.price),
                purchasedSkins: arrayUnion(item.id)
            });
            alert(`مبروك! اشتريت ${item.name} بنجاح ✅`);
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء الشراء');
        } finally {
            setBuying(null);
        }
    };

    return (
        <div className="store-container">
            {/* Header */}
            <header className="store-header">
                <button className="back-btn" onClick={onBack}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="20" height="20">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>
                <h1 className="store-title">متجر البصرة</h1>
                <div className="user-balance">
                    <span className="coin-icon">💰</span>
                    <span className="balance-text">{userCoins.toLocaleString()}</span>
                </div>
            </header>

            {/* Tabs */}
            <nav className="store-tabs">
                <button className={`tab-item ${activeTab === 'coins' ? 'active' : ''}`} onClick={() => setActiveTab('coins')}>شحن</button>
                <button className={`tab-item ${activeTab === 'cards' ? 'active' : ''}`} onClick={() => setActiveTab('cards')}>أطقم الورق</button>
                <button className={`tab-item ${activeTab === 'tables' ? 'active' : ''}`} onClick={() => setActiveTab('tables')}>الطاولات</button>
            </nav>

            {/* Content */}
            <main className="store-content">
                <div className="items-grid">
                    {filteredItems.map(item => {
                        const isOwned = purchasedSkins.includes(item.id);
                        return (
                            <div key={item.id} className="store-card">
                                {item.isNew && !isOwned && <span className="new-badge">جديد</span>}
                                {isOwned && <span className="new-badge owned">مملوك</span>}

                                <div className="item-preview">
                                    {item.category === 'cards' ? (
                                        <div
                                            className="card-back-preview"
                                            style={{
                                                backgroundColor: item.colors?.[0],
                                                borderColor: item.colors?.[1] || '#fff',
                                                backgroundImage: item.image.endsWith('.png') ? `url(${item.image})` : 'none',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center'
                                            }}
                                        >
                                            {!item.image.endsWith('.png') && (
                                                <>
                                                    <div className="card-inner-pattern" style={{ backgroundColor: item.colors?.[1] }} />
                                                    <div className="card-center-logo">{item.name.charAt(0)}</div>
                                                </>
                                            )}
                                        </div>
                                    ) : item.category === 'tables' ? (
                                        <div
                                            className="table-top-preview"
                                            style={{
                                                background: `radial-gradient(circle, ${item.colors?.[0]} 0%, ${item.colors?.[1]} 100%)`
                                            }}
                                        >
                                            <div className="table-inner-border" />
                                        </div>
                                    ) : (
                                        <span className="item-main-icon">{item.image}</span>
                                    )}
                                </div>

                                <div className="item-info">
                                    <h3 className="item-name">{item.name}</h3>
                                    <button
                                        className={`buy-btn ${isOwned ? 'owned' : ''}`}
                                        disabled={buying === item.id}
                                        onClick={() => handleBuy(item)}
                                    >
                                        {isOwned ? (
                                            'مملوك'
                                        ) : (
                                            <>
                                                <span className="price-tag">{item.category === 'coins' ? `$${item.price}` : item.price}</span>
                                                <span className="currency-label">{item.category === 'coins' ? '' : 'كوينز'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            <div className="store-footer">
                <div className="sadu-stripe"></div>
            </div>
        </div>
    );
}
