import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { STORE_ITEMS } from '../data/storeItems';
import './PurchasesScreen.css';

interface Props {
    onBack: () => void;
    userCoins: number;
}

export default function PurchasesScreen({ onBack, userCoins }: Props) {
    const [purchasedItems, setPurchasedItems] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (auth.currentUser) {
            const userDoc = doc(db, 'users', auth.currentUser.uid);
            const unsubscribe = onSnapshot(userDoc, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setPurchasedItems(data.purchasedSkins || []);
                }
                setLoading(false);
            });

            return () => unsubscribe();
        }
    }, []);

    const getPurchasedItems = () => {
        return STORE_ITEMS.filter(item => purchasedItems.includes(item.id));
    };

    if (loading) {
        return (
            <div className="purchases-screen">
                <div className="purchases-container">
                    <header className="purchases-header">
                        <button className="back-btn" onClick={onBack}>←</button>
                        <h1>مشترياتي</h1>
                    </header>
                    <div className="loading">جاري التحميل...</div>
                </div>
            </div>
        );
    }

    const items = getPurchasedItems();

    return (
        <div className="purchases-screen">
            <div className="purchases-container">
                <header className="purchases-header">
                    <button className="back-btn" onClick={onBack}>←</button>
                    <h1>مشترياتي</h1>
                    <div className="coins-display">
                        <span className="coin-icon">🪙</span>
                        <span>{userCoins.toLocaleString()}</span>
                    </div>
                </header>

                <main className="purchases-content">
                    {items.length === 0 ? (
                        <div className="empty-purchases">
                            <div className="empty-icon">🛍️</div>
                            <h3>لا توجد مشتريات بعد</h3>
                            <p>اذهب إلى المتجر لشراء العناصر المفضلة لديك</p>
                            <button className="go-to-store-btn" onClick={onBack}>
                                الذهاب إلى المتجر
                            </button>
                        </div>
                    ) : (
                        <div className="purchases-grid">
                            {items.map((item) => (
                                <div key={item.id} className="purchase-item">
                                    <div className="item-image">
                                        {item.image.startsWith('/') ? (
                                            <img src={item.image} alt={item.name} />
                                        ) : (
                                            <div className="item-emoji">{item.image}</div>
                                        )}
                                    </div>
                                    <div className="item-info">
                                        <h3>{item.name}</h3>
                                        <span className="item-category">
                                            {item.category === 'cards' ? 'طقم ورق' : 
                                             item.category === 'tables' ? 'طاولة' : 'عملات'}
                                        </span>
                                        {item.isNew && <span className="new-badge">جديد</span>}
                                    </div>
                                    <div className="item-status">
                                        <span className="owned-badge">✔ مملوك</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
