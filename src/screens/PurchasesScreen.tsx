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
                    <header className="purchases-header luxury-header">
                        <button className="back-btn luxury-btn" onClick={onBack}>←</button>
                        <div className="header-title">
                            <span className="bag-icon">👜</span>
                            <h1>حقيبتي</h1>
                        </div>
                        <div className="coins-display luxury-coins">
                            <span className="coin-icon">🪙</span>
                            <span>{userCoins.toLocaleString()}</span>
                        </div>
                    </header>
                    <div className="loading luxury-loading">جاري التحميل...</div>
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
                {/* Header */}
                <header className="purchases-header luxury-header">
                    <button className="back-btn luxury-btn" onClick={onBack}>←</button>
                    <div className="header-title">
                        <span className="bag-icon">👜</span>
                        <h1>حقيبتي</h1>
                    </div>
                    <div className="coins-display luxury-coins">
                        <span className="coin-icon">🪙</span>
                        <span>{userCoins.toLocaleString()}</span>
                    </div>
                </header>

                {/* Tabs */}
                <div className="luxury-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        <span className="tab-icon">✨</span>
                        <span className="tab-label">الكل</span>
                        <span className="tab-count">{allItems.length}</span>
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tables')}
                    >
                        <span className="tab-icon">🎲</span>
                        <span className="tab-label">الطاولات</span>
                        <span className="tab-count">{tables.length}</span>
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'cards' ? 'active' : ''}`}
                        onClick={() => setActiveTab('cards')}
                    >
                        <span className="tab-icon">🃏</span>
                        <span className="tab-label">الورق</span>
                        <span className="tab-count">{cards.length}</span>
                    </button>
                </div>

                {/* Content */}
                <main className="purchases-content luxury-content">
                    {currentItems.length === 0 ? (
                        <div className="empty-purchases luxury-empty">
                            <div className="empty-icon">�</div>
                            <h3>لا توجد {activeTab === 'tables' ? 'طاولات' : activeTab === 'cards' ? 'أوراق' : 'مشتريات'} بعد</h3>
                            <p>تفضل بزيارة المتجر لشراء العناصر الفاخرة</p>
                            <button className="go-to-store-btn luxury-store-btn" onClick={onBack}>
                                <span>🛒</span>
                                <span>الذهاب إلى المتجر</span>
                            </button>
                        </div>
                    ) : (
                        <div className="luxury-grid">
                            {currentItems.map((item) => {
                                const isTable = item.category === 'tables';
                                const isCard = item.category === 'cards';
                                const isActive = isTable 
                                    ? activeItems.tableSkin === item.id 
                                    : isCard 
                                        ? activeItems.cardSkin === item.id 
                                        : false;

                                return (
                                    <div 
                                        key={item.id} 
                                        className={`luxury-item ${isActive ? 'active-item' : ''}`}
                                        onClick={() => isTable || isCard ? setActiveItem(item.id, item.category as 'tables' | 'cards') : undefined}
                                    >
                                        <div className="item-glow"></div>
                                        <div className="item-frame">
                                            {isTable ? (
                                                <div 
                                                    className="table-preview"
                                                    style={{
                                                        background: item.colors 
                                                            ? `radial-gradient(circle, ${item.colors[0]} 0%, ${item.colors[1]} 100%)`
                                                            : '#333'
                                                    }}
                                                >
                                                    <span className="table-preview-icon">🎲</span>
                                                </div>
                                            ) : isCard ? (
                                                <div 
                                                    className="card-preview"
                                                    style={{
                                                        background: item.colors 
                                                            ? item.colors[0]
                                                            : '#222',
                                                        borderColor: item.colors?.[1] || '#444'
                                                    }}
                                                >
                                                    {item.image.endsWith('.png') ? (
                                                        <span className="card-logo">♠</span>
                                                    ) : (
                                                        <span className="card-emoji">{item.image}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="coin-bundle-preview">
                                                    <span className="coin-emoji">{item.image}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="item-details">
                                            <h3 className="item-name">{item.name}</h3>
                                            <div className="item-badges">
                                                {isActive && (
                                                    <span className="active-badge">⚡ مستخدم</span>
                                                )}
                                                {item.isNew && (
                                                    <span className="new-badge">🆕 جديد</span>
                                                )}
                                                <span className={`category-badge ${item.category}`}>
                                                    {isTable ? 'طاولة' : isCard ? 'ورق' : 'عملات'}
                                                </span>
                                            </div>
                                        </div>

                                        {isActive && (
                                            <div className="active-indicator">
                                                <span>✓</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>

                {/* Footer Info */}
                <footer className="luxury-footer">
                    <div className="stats-row">
                        <div className="stat-item">
                            <span className="stat-icon">🎲</span>
                            <span className="stat-label">الطاولات:</span>
                            <span className="stat-value">{tables.length}</span>
                        </div>
                        <div className="stat-divider">|</div>
                        <div className="stat-item">
                            <span className="stat-icon">🃏</span>
                            <span className="stat-label">الأوراق:</span>
                            <span className="stat-value">{cards.length}</span>
                        </div>
                        <div className="stat-divider">|</div>
                        <div className="stat-item">
                            <span className="stat-icon">💎</span>
                            <span className="stat-label">المجموع:</span>
                            <span className="stat-value">{allItems.length}</span>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
