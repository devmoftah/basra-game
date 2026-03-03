import { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { STORE_ITEMS, StoreItem } from '../data/storeItems';
import './StoreScreen.css';

// StoreItem interface is now imported from ../data/storeItems

interface Props {
    onBack: () => void;
    userCoins: number;
    purchasedSkins?: string[];
    activeCardSkin?: string;
    activeTableSkin?: string;
}

export default function StoreScreen({
    onBack,
    userCoins,
    purchasedSkins = [],
    activeCardSkin,
    activeTableSkin
}: Props) {
    const [activeTab, setActiveTab] = useState<'coins' | 'cards' | 'tables'>('coins');
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const filteredItems = STORE_ITEMS.filter(item => item.category === activeTab);

    const handleBuyOrEquip = async (item: StoreItem) => {
        if (!auth.currentUser) return;
        const isOwned = purchasedSkins.includes(item.id);

        if (item.category === 'coins') {
            alert('سيتم تفعيل نظام الدفع الحقيقي قريباً!');
            return;
        }

        setLoadingId(item.id);
        const userRef = doc(db, 'users', auth.currentUser.uid);

        try {
            if (isOwned) {
                // EQUIP Logic
                const updateData: any = {};
                if (item.category === 'cards') updateData.activeCardSkinId = item.id;
                if (item.category === 'tables') updateData.activeTableSkinId = item.id;
                await updateDoc(userRef, updateData);
            } else {
                // BUY Logic
                if (userCoins < item.price) {
                    alert('ليس لديك كوينز كافية!');
                    return;
                }
                await updateDoc(userRef, {
                    coins: increment(-item.price),
                    purchasedSkins: arrayUnion(item.id)
                });
                alert(`مبروك! اشتريت ${item.name} بنجاح ✅`);
            }
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء العملية');
        } finally {
            setLoadingId(null);
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
                    <span className="balance-text">{(userCoins || 0).toLocaleString()}</span>
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
                        const isActive = item.id === activeCardSkin || item.id === activeTableSkin;

                        return (
                            <div key={item.id} className={`store-card ${isActive ? 'active-card' : ''}`}>
                                {item.isNew && !isOwned && <span className="new-badge">جديد</span>}
                                {isOwned && !isActive && <span className="new-badge owned">مملوك</span>}
                                {isActive && <span className="new-badge active">مفعل</span>}

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
                                        className={`buy-btn ${isOwned ? 'owned' : ''} ${isActive ? 'active' : ''}`}
                                        disabled={loadingId === item.id || isActive}
                                        onClick={() => handleBuyOrEquip(item)}
                                    >
                                        {isActive ? (
                                            'مفعل'
                                        ) : isOwned ? (
                                            'تفعيل'
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
