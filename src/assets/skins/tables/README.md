# Table Skins Assets

## File Structure
```
src/assets/skins/tables/
├── classic_premium.png
├── [future_table_designs].png
└── README.md
```

## Design Requirements

### 📐 Image Specifications
- **Format:** PNG with transparent background
- **Resolution:** 1920x1080px minimum (4K recommended)
- **Aspect Ratio:** 16:9
- **File Size:** Under 2MB
- **Color Mode:** RGB

### 🎨 Design Elements

#### 1. Table Surface (Main Area)
- **Wood texture** or premium material
- **Subtle lighting** and shadows
- **Center area** for card placement
- **Edge details** and corner decorations

#### 2. Card Placement Areas
- **4 player positions** clearly marked
- **Center area** for table cards
- **Visual guides** for card alignment
- **Proper spacing** between areas

#### 3. Theme Consistency
- **Matches card colors** in the set
- **Cohesive style** throughout
- **Professional finish**
- **Cultural elements** (Libyan themes)

### 🎯 Premium Features
- **High-resolution details**
- **Animated elements** (optional)
- **Multiple variations** (day/night)
- **Special effects** (optional)

## 📁 File Naming Convention
```
[theme_name]_[variation].png
Examples:
- classic_premium.png
- modern_luxury.png
- traditional_gold.png
- royal_red.png
```

## 🚀 Implementation Notes

### CSS Integration
```css
.table-skin-t5 {
    background-image: url('/assets/skins/tables/classic_premium.png');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
}
```

### Performance Optimization
- **Compress images** before adding
- **Use WebP format** for better compression
- **Lazy loading** for better performance
- **Multiple resolutions** for different screens

## 🎨 Design Inspiration

### Libyan Themes
- **Traditional patterns** (Zawiya, Tatreez)
- **Modern luxury** (Gold, Marble)
- **Cultural elements** (Islamic patterns)
- **Local materials** (Wood, Stone)

### Color Palettes
- **Classic:** Brown #8B4513, Cream #D2691E
- **Royal:** Deep Red #990000, Gold #FFD700
- **Modern:** Dark Gray #2C3E50, Light Blue #3498DB
- **Luxury:** Black #1A1A1A, Gold #D4AF37
