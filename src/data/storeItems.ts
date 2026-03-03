export interface StoreItem {
    id: string;
    name: string;
    price: number;
    image: string;
    category: 'coins' | 'cards' | 'tables';
    isNew?: boolean;
    colors?: string[]; // [primary/inner, secondary/outer]
}

export const STORE_ITEMS: StoreItem[] = [
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
