import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { STORE_ITEMS } from '../data/storeItems';
import './PurchasesScreen.css';

type TabType = 'all' | 'tables' | 'cards';

interface Props {
    onBack: () => void;
    userCoins: number;
}

export default function PurchasesScreen({ onBack, userCoins }: Props) {
    const [purchasedItems, setPurchasedItems] = useState<string[]>([]);
    const [activeItems, setActiveItems] = useState<{ cardSkin: string; tableSkin: string }>({ cardSkin: 'k1', tableSkin: 't1' });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('all');

    useEffect(() => {
        if (auth.currentUser) {
            const userDoc = doc(db, 'users', auth.currentUser.uid);
            const unsubscribe = onSnapshot(userDoc, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setPurchasedItems(data.purchasedSkins || []);
                    setActiveItems({
                        cardSkin: data.activeCardSkinId || 'k1',
                        tableSkin: data.activeTableSkinId || 't1'
                    });
                }
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            setLoading(false);
        }
    }, []);

    const getItemsByCategory = (category: 'tables' | 'cards') => {
        return STORE_ITEMS.filter(item =>
            purchasedItems.includes(item.id) && item.category === category
        );
    };

    const getAllPurchasedItems = () => {
        return STORE_ITEMS.filter(item => purchasedItems.includes(item.id));
    };

    const setActiveItem = async (itemId: string, category: 'tables' | 'cards') => {
        if (!auth.currentUser) return;
        try {
            const userDoc = doc(db, 'users', auth.currentUser.uid);
            const updateData = category === 'tables'
                ? { activeTableSkinId: itemId }
                : { activeCardSkinId: itemId };
            await updateDoc(userDoc, updateData);
        } catch (error) {
            console.error('Error setting active item:', error);
        }
    };

    if (loading) {
        return (
            <div className="purchases-screen">
                <div className="purchases-container luxury">
                    <div className="loading-state">
                        <div className="loader"></div>
                        <p>جاري تحضير مقتنياتك الملكية...</p>
                    </div>
                </div>
            </div>
        );
    }

    const tables = getItemsByCategory('tables');
    const cards = getItemsByCategory('cards');
    const allItems = getAllPurchasedItems();
    const currentItems = activeTab === 'all' ? allItems :
        activeTab === 'tables' ? tables : cards;

    return (
        <div className="purchases-screen">
            <div className="purchases-container luxury">

                {/* ── HEADER ── */}
                <header className="purchases-header luxury-header">
                    <button className="back-btn luxury-btn" onClick={onBack} title="الرجوع للقائمة">
                        <span>‹</span>
                    </button>

                    <div className="header-title">
                        <span className="bag-icon">💎</span>
                        <h1>خزنتي الملكية</h1>
                    </div>

                    <div className="coins-display luxury-coins">
                        <span className="coin-amount">{userCoins.toLocaleString()}</span>
                        <span className="coin-label">كوينز</span>
                        <span className="coin-icon">🪙</span>
                    </div>
                </header>

                {/* ── TABS ── */}
                <div className="luxury-tabs">
                    <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
                        <span className="tab-icon">👑</span>
                        <span className="tab-label">المجموعة الكاملة</span>
                        <span className="tab-count">{allItems.length}</span>
                    </button>
                    <button className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`} onClick={() => setActiveTab('tables')}>
                        <span className="tab-icon">🎲</span>
                        <span className="tab-label">صالة الطاولات</span>
                        <span className="tab-count">{tables.length}</span>
                    </button>
                    <button className={`tab-btn ${activeTab === 'cards' ? 'active' : ''}`} onClick={() => setActiveTab('cards')}>
                        <span className="tab-icon">🃏</span>
                        <span className="tab-label">أطقم الورق</span>
                        <span className="tab-count">{cards.length}</span>
                    </button>
                </div>

                {/* ── MAIN CONTENT ── */}
                <main className="purchases-content luxury-content">
                    {currentItems.length === 0 ? (
                        <div className="luxury-empty">
                            <span className="empty-icon">🏰</span>
                            <h3>خزنتك لا تحتوي على هذا النوع حالياً</h3>
                            <button className="go-to-store-btn luxury-btn" onClick={onBack}>استكشف المتجر الملكي</button>
                        </div>
                    ) : (
                        <div className="luxury-grid">
                            {currentItems.map((item) => {
                                const isTable = item.category === 'tables';
                                const isActive = isTable ? activeItems.tableSkin === item.id : activeItems.cardSkin === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        className={`luxury-item ${isActive ? 'active-item' : ''}`}
                                        onClick={() => (item.category === 'tables' || item.category === 'cards') && setActiveItem(item.id, item.category)}
                                    >
                                        {isActive && <div className="active-indicator">✓</div>}

                                        <div className="item-frame">
                                            {isTable ? (
                                                <div
                                                    className="table-preview"
                                                    style={{ background: item.colors ? `radial-gradient(circle, ${item.colors[0]} 0%, ${item.colors[1]} 100%)` : '#333' }}
                                                >
                                                    <div className="table-preview-inner"></div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="card-preview"
                                                    style={{
                                                        background: item.colors ? item.colors[0] : '#222',
                                                        borderColor: item.colors?.[1] || '#fff'
                                                    }}
                                                >
                                                    {item.image.endsWith('.png') ? <span style={{ fontSize: 40 }}>♠</span> : <span style={{ fontSize: 40 }}>{item.image}</span>}
                                                </div>
                                            )}
                                        </div>

                                        <div className="item-details">
                                            <h3 className="item-name">{item.name}</h3>
                                            <div className="item-badges">
                                                {isActive && <span className="badge badge-active">قيد الاستخدام</span>}
                                                {item.isNew && <span className="badge badge-new">نادر</span>}
                                                <span className="badge badge-category">{isTable ? 'طاولة' : 'ورق'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>

                {/* ── FOOTER STATS ── */}
                <footer className="luxury-footer">
                    <div className="stats-container">
                        <div className="stat-box">
                            <span className="stat-label">إجمالي المقتنيات</span>
                            <span className="stat-val">{allItems.length}</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-label">الطاولات النادرة</span>
                            <span className="stat-val">{tables.length}</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-label">أطقم الأوراق</span>
                            <span className="stat-val">{cards.length}</span>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
