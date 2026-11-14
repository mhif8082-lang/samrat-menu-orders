// ─────────────────────────────────────────────────────────────────────────────
// Samrat Menu Orders: the restaurant menu (prices in NPR).
//
// HOW TO EDIT (plain text below):
//   ## Category name | station          ← station: tandoor, kitchen or bar
//   Dish name | price | description      ← description is optional
//   Dish name | Small 200, Large 250     ← sizes/styles: guest picks one
//   Dish name | -                        ← price not known: shown as "Ask staff", can't be ordered yet
//
// This file SEEDS the database. After editing it run:  npm run reset-menu
// (Day-to-day price changes and sold-out switches are done in the app: Staff → Menu.)
// ─────────────────────────────────────────────────────────────────────────────

const MENU_TEXT = `
## Breakfast (7–10 AM) | kitchen
Simple Breakfast Set | 450 | Two eggs any style, hash brown potato, jam/butter & black tea
Italian Breakfast Set | 480 | Cheese, tomato & mushroom omelette, 2 toast, jam/butter, hash brown potato & tea/coffee

## Indian Breakfast | kitchen
Three Chapati Set | 400 | Three chapati, veg curry or curd & milk tea
Two Aalu Paratha Set | 400 | Two aalu paratha, chana masala & milk tea
Puri Sabji with Milk Tea | 400
Plain Toast | 100 | With butter or jam
Masala Omelette Set | 400 | Masala omelette with 2 toast, butter & tea

## Egg Items | kitchen
Two Eggs | Plain Omelette 150, Boiled 150
Cheese Tomato Mushroom Omelette | 300
Masala Omelette | 180
Egg Bhujiya | 180

## Hot Drinks | bar
Milk Tea | 100
Black Tea | 80
Black Coffee | 100
Milk Coffee | 150
Hot Milk | 150
Hot Chocolate | 250
Ginger Lemon with Honey | 250
Hot Lemon | 100
Hot Lemon with Honey | 200
Masala Tea | 180
Lemon Grass Tea | 250
Green Tea | 200

## Khaja (Nasta) Set | kitchen
Chicken Khaja Set | 550
Local Chicken Khaja Set | 600
Mutton Khaja Set | 650
Fish Khaja Set | 600

## Sandwich | kitchen
Veg Sandwich | 300
Tomato Cheese Sandwich | 380
Chicken Sandwich | 370
Tuna Sandwich | 390
Club Sandwich | 410

## Indian Thali (Unlimited) | kitchen
Indian Veg Thali | 480 | Unlimited, for one person
Indian Chicken Thali | 650 | Unlimited, for one person
Indian Mutton Thali | 680 | Unlimited, for one person
Indian Fish Thali | 600 | Unlimited, for one person

## Nepali Khana & Dhido Set | kitchen
Veg Khana Set | 390
Chicken Khana Set | 550
Local Chicken Khana Thali Set | 650
Mutton Khana Set | 650
Fish Khana Set | 600
Dhido Set (Veg) | 600
Local Chicken Dhido Set | 700
Chicken Dhido Set | 650
Mutton Dhido Set | 750
Fish Dhido Set | 650

## Tandoor & Grill | tandoor
Tandoori Chicken | Quarter 300, Half 600, Full 1200 | Spice-marinated and roasted in the tandoor with a smoky char
Tandoori Leg | 400
Chicken Tikka | 600
Chicken Kabab | 650
Chicken Sekuwa | 480
Grilled Chicken | 1200
Tandoori Grilled Fish | 1200

## Non-Veg Snacks | kitchen
Chicken Chilly | 450
Pangra Poleko | 500
Chicken Fried (8 pcs) | 480
Chicken 65 | 490
Buffalo Chicken Wings | 480
Chicken Leg Fried (per pc) | 250
Chicken Wings (2 pcs) | 300
Chicken Lollipop (5 pcs) | 450
Chicken Sausage (per plate) | 300
Sausage Chilly | 400
Pangra Fried | 380
Pangra Chilly | 400
Chicken Crunchy | 550
Chicken Pakoda | 450

## Mutton Snacks | kitchen
Mutton Bhutuwa | 400
Mutton Sekuwa | 600
Mutton Dry | 600
Mutton Special | - | Name and price to be confirmed

## Mo:Mo | kitchen
Veg Mo:Mo | Steam 200, Fried 250
Chicken Mo:Mo | Steam 200, Fried 250
Veg Chilly Mo:Mo | 400
Chicken Chilly Mo:Mo | 400
Jhol Mo:Mo | Veg 400, Chicken 400

## Chowmein & Noodles | kitchen
Veg Chowmein | 250
Chicken Chowmein | 350
Egg Chowmein | 350
Mixed Chowmein | 400
Ramen with Egg & Sausage | 450
Ramen Noodle | 350

## Thukpa & Soup | kitchen
Veg Thukpa | 350
Chicken Thukpa | 380
Mix Thukpa | 400 | Chicken, veg & egg
Egg Thukpa | 380
Veg Soup | 250
Mushroom Soup | 300
Chicken Soup | 300
Chicken Mix Mushroom Soup | 350
Hot & Sour Soup | 380

## Biryani & Fried Rice | kitchen
Veg Biryani | 450
Mushroom Biryani | 450
Chicken Biryani | 490
Mutton Biryani | 600
Egg Biryani | 400
Veg Fried Rice | 300
Chicken Fried Rice | 380
Egg Fried Rice | 350
Mixed Fried Rice | 400 | Chicken & egg
Plain Rice | 180
Jeera Rice | 250 | Cumin rice

## Fish Snacks | kitchen
Fish Fried | 480
Prawn Fried | 700
Prawn Chilly | 900

## Sandheko (Chatpata) | kitchen
Peanut Sandheko | 200
Bhatmas Sandheko | 200
Plain Peanut | 100
Aalu Sandheko | 250
Chicken Sandheko | 450
Noodles Sandheko | 200
Pop Corn | 200
Sweet Corn | 300

## Salad | kitchen
Green Salad | 250
Fresh Fruit Salad | 400
Greek Salad | 400
Onion Salad | 150

## Non-Veg Curry | kitchen
Chicken Curry | 390 | Curry or gravy
Local Chicken Curry | 490 | Curry or gravy
Chicken Kadai | 480
Chicken Tikka Masala (Boneless) | 600
Chicken Butter Masala | Quarter 650, Half 1200, Full 2400
Butter Chicken | 650 | Tender chicken in a silky tomato, butter and cream gravy
Palak Chicken | 650
Chicken Keema Curry | 400
Mutton Curry | 550 | Curry or gravy
Fish Curry | 450 | Curry or gravy
Egg Curry | 300
Chicken Do Pyaja | 500
Chicken Lababdar | 650
Chicken Rogan Josh | 650
Chicken Vindaloo | 700

## Vegetarian Curry | kitchen
Mix Veg Curry | 200
Chana Masala | 200
Dal Fried | 200 | Lentils
Dal Tadka | 250 | Lentils
Butter Dal Fried | 250
Dal Makhani | 280
Rajma | 200 | Red beans
Aalu Mutter Gravy | 300
Aalu Gravy | 300
Mutter Mushroom Curry | 400
Aalu Mutter Mushroom Curry | 400
Mushroom Curry | 380
Mutter Paneer | 400
Paneer Butter Masala | 400
Kadai Paneer | 450
Palak Paneer | 450
Paneer Tikka Masala | 600
Shahi Paneer | 550
Malai Kofta | 500
Aalu Jeera | 250
Aalu Bhujiya | 200
Saag Dry (Rayo Saag) | 150
Curd | 120
Veg Raita | 200
Bhindi Vaji | 300
Paneer Bhurjee | 400
Paneer Do-Pyaja | 500

## Naan & Roti | tandoor
Butter Naan | 100
Plain Naan | 90
Garlic Naan | 120
Chicken Keema Naan | 200
Aalu Naan | 180 | Potato naan
Cheese Naan | 300
Paneer Naan | 250
Aalu Paratha | 120
Tandoori Roti | 40 | Chapati
Butter Roti | 50
Garlic Roti | 70
Lachha Paratha | 120
Onion Naan | 150
Cheese Garlic Butter Naan | 300
Chocolate Naan | 250
Plain Naan with Honey | -

## Fresh Juice | bar
Seasonal Fresh Fruit Juice | 300
Mixed Fruit Juice | 350

## Soft Drinks | bar
Soft Drink | Coke 100, Fanta 100, Sprite 100, Soda 100, Dew 100, Pepsi 100, Slice 100
Water | 40
Longtang Himalayan Mineral Water | 100
Fresh Lemon Soda | 150
Lemon Coke / Sprite | Lemon Coke 150, Lemon Sprite 150
Red Bull Gold | 280
Red Bull Blue | 390
Badam Juice | 180
Tonic Water | 250
Zero Coke (500ml) | 180
Can Juice | 250

## Lassi & Milkshake | bar
Plain Lassi | 200
Mixed Fruit Lassi / Shake | Lassi 300, Shake 300
Banana Lassi / Shake | Lassi 250, Shake 250
Avocado Lassi / Shake | Lassi 380, Shake 380
Mango Lassi | 350
Chocolate Lassi | 350
Vanilla Lassi | 350

## Beer | bar
Gorkha Premium Beer | 650
Gorkha Strong Beer | 600
Gorkha Strong 8% (Small) | 350
Tuborg Beer | 680
Carlsberg Beer | 720
Apple Cider | 350
Barahsinghe | 650
Barahsinghe (Small) | 350

## Can Beer | bar
Gorkha Can Beer | 450
Tuborg Can Beer | 500
Carlsberg Can Beer | 550
Barahsinghe Can | 450

## Hard Drinks | bar
Ruslan Vodka | 60ml 400, 90ml 600, Quarter 950, Half 1800, Full 3400
Nude Vodka | 60ml 400, 90ml 600, Quarter 950, Half 1800, Full 3400
Khukuri Rum | 60ml 400, 90ml 600, Quarter 950, Half 1800, Full 3400
Royal Stag | 60ml 400, 90ml 600, Quarter 950, Half 1800, Full 3400
Signature Green | 60ml 400, 90ml 600, Quarter 950, Half 1800, Full 3400
Signature Red | 60ml 450, 90ml 600, Quarter 1100, Half 1950, Full 3600
Old Durbar Regular | 60ml 480, 90ml 650, Quarter 1200, Half 2100, Full 3800
Old Durbar Chimney | 60ml 450, 90ml 650, Quarter 1050, Half 2000, Full 3800
Absolut Vodka | 60ml 500, 90ml 800, Quarter 1250, Half 2600, Full 4800
Old Monk Rum | 60ml 450, 90ml 600, Quarter 980, Half 1800, Full 3500
8848 Vodka | -
Grand Master | -

## Wine & Hookah | bar
Hookah | 600 | Flavour of your choice
Big Master Wine | -
Divine Wine | -
Marpha Wine | -
Jacob's Creek | -
J.P. Chenet | -
Robertson Winery | -
Jameson | -

## Ice Cream (Havmor) | bar
Turbo Cone | -
Blockbuster Wild Berries | -
Blockbuster Triple Chocolate | -
Choco Block | -
Biscotti | -
Blueberry Cheesecake | -
Hazelnut Chiffon | -
Strawberry | - | Buy 1 get 1 free
`;

// Photos we have for some dishes.
const PHOTOS = {
  'butter-chicken': 'butter-chicken', 'chicken-butter-masala': 'chicken-butter-masala', 'chicken-curry': 'chicken-curry',
  'tandoori-chicken': 'tandoori-chicken', 'garlic-naan': 'garlic-naan', 'cheese-naan': 'cheese-naan',
  'butter-naan': 'butter-naan', 'plain-naan': 'plain-naan', 'chicken-biryani': 'biryani',
  'mutton-biryani': 'mutton-biryani', 'veg-biryani': 'veg-biryani',
};
const BADGES = { 'butter-chicken': 'House favourite', 'tandoori-chicken': 'Tandoor special', 'garlic-naan': 'Perfect for dipping', 'chicken-biryani': 'Popular', 'chicken-mo-mo': 'Popular' };
const NON_VEG = /mixed chowmein|chicken|mutton|fish|prawn|egg|omelette|tuna|sausage|keema|pangra|buffalo|khaja|club sandwich|breakfast set|masala omelette|lollipop/i;

export const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parse(text) {
  const categories = []; const items = []; let cat = 'Menu'; let station = 'kitchen';
  for (const raw of text.split('\n')) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith('##')) { [cat, station = 'kitchen'] = line.slice(2).split('|').map(s => s.trim()); categories.push(cat); continue; }
    const [name, priceText = '-', description = ''] = line.split('|').map(s => s.trim());
    let id = slug(name); while (items.some(d => d.id === id)) id += '-2';
    let price = 0; let options;
    if (/,|[a-z]\s+\d/i.test(priceText)) {
      options = priceText.split(',').map(p => { const m = p.trim().match(/^(.*?)\s+(\d+)$/); return { label: m[1], price: Number(m[2]) }; });
      price = Math.min(...options.map(o => o.price));
    } else if (/^\d+$/.test(priceText)) price = Number(priceText);
    const mixed = /^jhol mo:mo$/i.test(name); // sold in veg and chicken versions
    const veg = station === 'bar' || mixed ? undefined : !NON_VEG.test(`${name} ${description}`) && !/non-veg|khaja|fish|mutton|grill/i.test(cat);
    items.push({
      id, name, category: cat, station, price, ...(options && { options }),
      description, ...(veg !== undefined && { veg }),
      ...(PHOTOS[id] && { image: `/assets/food/${PHOTOS[id]}.webp` }),
      ...(BADGES[id] && { badge: BADGES[id] }),
      available: price > 0,
    });
  }
  return { categories, items };
}

const parsed = parse(MENU_TEXT);
export const CATEGORIES = parsed.categories;
export const SEED_MENU = parsed.items;
