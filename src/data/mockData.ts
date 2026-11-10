import {
  CompanyDomain,
  MenuCategory,
  MenuItem,
  UserProfile,
  DropoffFloor,
  OrderHistoryItem,
  CycleWeekConfig,
  CorporateAccount,
  CycleWeekPlan,
  DietaryTag,
} from '../types';

export const WHITELISTED_COMPANY_DOMAINS: CompanyDomain[] = [
  {
    id: 'comp_ecogra',
    domain: 'ecogra.org',
    companyName: 'eCOGRA',
    locationName: 'eCOGRA Rosebank Hub',
    buildingName: 'Rosebank Office Park',
    deliveryFloor: 'Floor 2 (IT & Compliance Pantry)',
    distanceKm: 6.5,
    isActive: true,
  },
  {
    id: 'comp_ecogra_za',
    domain: 'ecogra.co.za',
    companyName: 'eCOGRA',
    locationName: 'eCOGRA Rosebank Hub',
    buildingName: 'Rosebank Office Park',
    deliveryFloor: 'Floor 2 (IT & Compliance Pantry)',
    distanceKm: 6.5,
    isActive: true,
  },
  {
    id: 'comp_rcl',
    domain: 'rclfoods.com',
    companyName: 'RCL Foods',
    locationName: 'RCL Foods Dunkeld HQ',
    buildingName: 'Ten Bompas Office Complex, Building 2',
    deliveryFloor: 'Floor 1 (Corporate Canteen Pantry)',
    distanceKm: 7.2,
    isActive: true,
  },
  {
    id: 'comp_rcl_za',
    domain: 'rclfoods.co.za',
    companyName: 'RCL Foods',
    locationName: 'RCL Foods Dunkeld HQ',
    buildingName: 'Ten Bompas Office Complex, Building 2',
    deliveryFloor: 'Floor 1 (Corporate Canteen Pantry)',
    distanceKm: 7.2,
    isActive: true,
  },
  {
    id: 'comp_tata',
    domain: 'tataafrica.com',
    companyName: 'TATA Africa Holdings',
    locationName: 'TATA Sandton Towers',
    buildingName: '140 West Street Building, Tower B',
    deliveryFloor: 'Tower B, Floor 4 (Holding Operations Staging)',
    distanceKm: 9.8,
    isActive: true,
  },
  {
    id: 'comp_tata_com',
    domain: 'tata.com',
    companyName: 'TATA Africa Holdings',
    locationName: 'TATA Sandton Towers',
    buildingName: '140 West Street Building, Tower B',
    deliveryFloor: 'Tower B, Floor 4 (Holding Operations Staging)',
    distanceKm: 9.8,
    isActive: true,
  },
  {
    id: 'comp_kyc',
    domain: 'kyc.com',
    companyName: 'Your Kitchen Co.',
    locationName: 'Central Command Kitchen',
    buildingName: 'Kitchen Co Headquarters',
    deliveryFloor: 'Executive Suite',
    distanceKm: 0.0,
    isActive: true,
  },
  {
    id: 'comp_kitchenco',
    domain: 'kitchenco.co.za',
    companyName: 'Your Kitchen Co.',
    locationName: 'Central Command Kitchen',
    buildingName: 'Kitchen Co Headquarters',
    deliveryFloor: 'Executive Suite',
    distanceKm: 0.0,
    isActive: true,
  },
  {
    id: 'comp_intellect',
    domain: 'intellectdesign.com',
    companyName: 'Intellect Design Arena',
    locationName: 'Intellect Design • Sandhurst Building 1',
    buildingName: '11 Alice Lane, Sandhurst, Building 1',
    deliveryFloor: 'Floor 3 (Reception Pantry)',
    distanceKm: 8.0,
    isActive: true,
  },
  {
    id: 'comp_intellect_za',
    domain: 'intellectdesign.co.za',
    companyName: 'Intellect Design Arena',
    locationName: 'Intellect Design • Sandhurst Building 1',
    buildingName: '11 Alice Lane, Sandhurst, Building 1',
    deliveryFloor: 'Floor 3 (Reception Pantry)',
    distanceKm: 8.0,
    isActive: true,
  },
];

export const INITIAL_CORPORATE_ACCOUNTS: CorporateAccount[] = [
  {
    id: 'corp_ecogra',
    companyName: 'eCOGRA',
    domains: ['ecogra.org', 'ecogra.co.za'],
    activeUsersCount: 48,
    locations: [
      '160 Jan Smuts Ave, Rosebank, Floor 2 (IT & Compliance Pantry)',
      '160 Jan Smuts Ave, Rosebank, Floor 3 (Executive Boardroom Staging)',
      '160 Jan Smuts Ave, Rosebank, Ground Floor (Main Reception)',
    ],
    distanceKm: 6.5,
    discountType: 'percentage',
    discountValue: 10,
    discountPercentage: 10,
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'corp_rcl',
    companyName: 'RCL Foods',
    domains: ['rclfoods.com', 'rclfoods.co.za'],
    activeUsersCount: 165,
    locations: [
      'Ten Bompas Road, Dunkeld West, Building 2, Floor 1 (Corporate Canteen Pantry)',
      'Ten Bompas Road, Dunkeld West, Building 2, Floor 3 (Consumer Division Lounge)',
      'Ten Bompas Road, Dunkeld West, Building 2, Ground Floor (Security Concierge)',
    ],
    distanceKm: 7.2,
    discountType: 'percentage',
    discountValue: 12,
    discountPercentage: 12,
    createdAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'corp_tata',
    companyName: 'TATA Africa Holdings',
    domains: ['tataafrica.com', 'tata.com'],
    activeUsersCount: 92,
    locations: [
      '140 West Street, Sandton, Tower B, Floor 4 (Holding Operations Staging)',
      '140 West Street, Sandton, Tower B, Floor 6 (Executive Boardroom Suite)',
      '140 West Street, Sandton, Tower B, Ground Floor (Visitor Concierge)',
    ],
    distanceKm: 9.8,
    discountType: 'percentage',
    discountValue: 10,
    discountPercentage: 10,
    createdAt: '2026-02-15T08:00:00Z',
  },
  {
    id: 'corp_01',
    companyName: 'Intellect Design Arena',
    domains: ['intellectdesign.com', 'intellectdesign.co.za'],
    activeUsersCount: 142,
    locations: [
      '11 Alice Lane, Sandhurst, Building 1, Floor 3 (Reception Pantry)',
      '11 Alice Lane, Sandhurst, Building 1, Floor 4 (Engineering)',
      '11 Alice Lane, Sandhurst, Building 1, Floor 5 (Operations)',
    ],
    distanceKm: 8.0,
    discountType: 'percentage',
    discountValue: 10,
    discountPercentage: 10,
    createdAt: '2026-01-15T08:00:00Z',
  },
];

export const DELIVERY_FEE_TIERS = [
  { minKm: 0, maxKm: 15.0, feeZar: 100.0, label: '0 – 15 km (R100)' },
  { minKm: 15.01, maxKm: 20.0, feeZar: 140.0, label: '15.01 – 20 km (R140)' },
  { minKm: 20.01, maxKm: 30.0, feeZar: 200.0, label: '20.01 – 30 km (R200)' },
  { minKm: 30.01, maxKm: 50.0, feeZar: 350.0, label: '30.01 – 50 km (R350)' },
];

export function getDeliveryFeeForDistance(distanceKm: number = 8.0): number {
  if (distanceKm <= 15.0) return 100.0;
  if (distanceKm <= 20.0) return 140.0;
  if (distanceKm <= 30.0) return 200.0;
  if (distanceKm <= 50.0) return 350.0;
  return 350.0;
}

export const INITIAL_CYCLE_WEEKS: CycleWeekConfig[] = [
  {
    weekNumber: 1,
    title: 'Heritage & Hearth Classics',
    description: 'BBQ Quarter Chicken, Durban Curries, and Shish Kebabs.',
    mealCount: 25,
    status: 'active_now',
  },
  {
    weekNumber: 2,
    title: 'Coastal Harvest & Slow Roasts',
    description: 'Thai Green Curries, Lasagne, and Overnight Slow-Cooked Brisket.',
    mealCount: 25,
    status: 'scheduled_next',
  },
  {
    weekNumber: 3,
    title: 'Cape Malay & Mediterranean Spice',
    description: 'Chicken Schnitzels, Beef Stew with Samp, and Palak Paneer.',
    mealCount: 25,
    status: 'inactive',
  },
  {
    weekNumber: 4,
    title: 'Artisan Hearth & Global Comfort',
    description: 'Chilli con Carne Wraps, Butter Chicken, and Beef Prego Rolls.',
    mealCount: 25,
    status: 'inactive',
  },
  {
    weekNumber: 5,
    title: 'Pan-Asian Fusion & Wok Bowls',
    description: 'Beef Goulash, Japanese Beef Curry, and Boerewors Rolls.',
    mealCount: 25,
    status: 'inactive',
  },
  {
    weekNumber: 6,
    title: 'Highveld Comfort & Braai Essence',
    description: 'Vietnamese Lemon Grass Noodles, Beef Bourguignon, and Cottage Pie.',
    mealCount: 25,
    status: 'inactive',
  },
  {
    weekNumber: 7,
    title: 'Mediterranean Sun & Tuscan Pastas',
    description: 'Beef Boerewors with Pap, Souvlaki Wraps, and Tandoori Chicken.',
    mealCount: 25,
    status: 'inactive',
  },
  {
    weekNumber: 8,
    title: "Executive Chef's Grand Showcase",
    description: 'Roast Chicken with Gravy, Beef Stew, and Chicken Schnitzel.',
    mealCount: 25,
    status: 'inactive',
  },
];

export const DROPOFF_FLOORS: DropoffFloor[] = [
  {
    id: 'fl_03',
    label: 'Floor 3 (Reception Pantry)',
    description: 'Main corporate pantry drop-off & heated staging shelf',
    isDefault: true,
  },
  {
    id: 'fl_04',
    label: 'Floor 4 (Product & Engineering)',
    description: 'Engineering break room & snack station',
  },
  {
    id: 'fl_05',
    label: 'Floor 5 (Operations & Sales)',
    description: 'West wing pantry counter',
  },
  {
    id: 'fl_06',
    label: 'Floor 6 (Executive Boardroom & Suites)',
    description: 'Executive pantry & meeting room staging',
  },
  {
    id: 'fl_ground',
    label: 'Ground Floor Concierge Desk',
    description: 'Building 1 main security & reception delivery hub',
  },
];

export const MOCK_USER_PROFILE: UserProfile = {
  id: 'usr_mock_001',
  email: 'alex.vanderberg@intellectdesign.com',
  fullName: 'Alex Van Der Berg',
  phoneNumber: '+27 82 555 0192',
  role: 'admin', // Default to Admin for comprehensive access & demo switching
  companyId: 'comp_intellect',
  companyName: 'Intellect Design Arena',
  locationName: 'Intellect Design • Sandhurst Building 1',
  buildingName: '11 Alice Lane, Sandhurst, Building 1',
  deliveryFloor: 'Floor 3 (Reception Pantry)',
  createdAt: '2026-08-01T08:00:00Z',
};

// ============================================================================
// 8-WEEK CYCLE MENU DATA
// ============================================================================
export const EIGHT_WEEK_CYCLE_DATA: CycleWeekPlan[] = [
  {
    week: 1,
    days: [
      {
        day: 'Monday',
        main_meal: 'Quarter Chicken basted in our home made BBQ sauce served with Middle Eastern Potato Wedges and Ginger infused Carrots and Broccoli',
        vegetarian_meal: 'Lentils, Baby Marrow and Cauliflower Fritters served with Mash Potato and Tomato Chantey',
        healthy_meal: 'Saucy BBQ Chicken Fillet Strips on Bulgur Wheat, Vegetables and Herb Salad',
        curry_of_the_day: 'Bombay Beef curry served with Basmati Rice served with Sambals',
        gourmet_sandwich: 'Roasted Beef Baguette topped with mustard, Gherkins and Rocket',
      },
      {
        day: 'Tuesday',
        main_meal: 'Beef Meatballs in a Rich Tomato, Basil and Garlic sauce served on a bed of Penne Pasta accompanied by a side of Sage Green Beans',
        vegetarian_meal: 'Penne Pasta tossed in a Rich Tomato, Basil and Garlic sauce. Topped with Danish Feta and Parmesan Crumb',
        healthy_meal: 'Beef Shish Kebab accompanied by Chimichurri sauce served with Savoury Brown Rice and Steamed Vegetables drizzled with a Ginger Garlic Dressing',
        curry_of_the_day: 'South India Chicken Curry served with Basmati Rice',
        gourmet_sandwich: 'Panini Filled with Deboned Grilled Chicken Thighs, Humus and Salad',
      },
      {
        day: 'Wednesday',
        main_meal: 'Oven Roasted Chicken served with Roast Potatoes and Cauliflower Cheese Sauce',
        vegetarian_meal: 'Creamy Cheese Seasonal Vegetable Bake',
        healthy_meal: 'Beef Wrap with Chickpeas, Lentils, Beetroot, Butternut and salad',
        curry_of_the_day: 'Lamb Rogan Josh served with Basmati Rice',
        gourmet_sandwich: 'Panini filled with Meatballs, Napolitana sauce and Mozzarella',
      },
      {
        day: 'Thursday',
        main_meal: 'Persian Beef Stew served with Pap and Spicy Spinach',
        vegetarian_meal: 'Persian Vegetable and Bean Stew served with Mash Potato',
        healthy_meal: 'Cajun chicken Salad with Quinoa and Roasted Vegetables',
        curry_of_the_day: 'Thai Red Chicken Curry and Vegetables served with Jasmin Rice',
        gourmet_sandwich: 'Amazing Vietnamese Chicken, Herbs and Vegetable Baguette',
      },
      {
        day: 'Friday',
        main_meal: 'Korean Chicken Burger served with Potato Wedges and Cucumber Salad',
        vegetarian_meal: 'Korean inspired Haloumi and Aubergine Burger served with Potato Wedges and Cucumber Salad',
        healthy_meal: 'Flame Grilled Korean Chicken Quarters served with Roasted Aubergine Wedges and Spiced Green Salad',
        curry_of_the_day: 'Massaman Mince Curry served with Jasmin Rice and topped with a Fried Egg',
        gourmet_sandwich: 'Beef Shwarma with all the trimmings',
      },
    ],
  },
  {
    week: 2,
    days: [
      {
        day: 'Monday',
        main_meal: 'Beef Lasagne served with a side Green Salad',
        vegetarian_meal: 'Stuffed Peppers served with Rice, Lentils and a Side Salad',
        healthy_meal: 'Cajun Chicken Poke Bowl (Green Beans / Cabbage / Cucumber / Corn and Humus) drizzled with a Harissa Dressing',
        curry_of_the_day: 'Durban Beef Curry served with Basmati Rice and Sambals',
        gourmet_sandwich: 'Smoked Chicken Baguette filled with Coleslaw and Avo (Seasonal)',
      },
      {
        day: 'Tuesday',
        main_meal: 'Thai Green Chicken Curry served with Jasmin Rice and Roasted Butternut & Baby Marrow',
        vegetarian_meal: 'Mushroom, Broccoli and Parmesan Risotto',
        healthy_meal: 'Grilled Chicken Thigh served with Broccoli',
        curry_of_the_day: 'South India Fish Curry served with Basmati Rice and Peas',
        gourmet_sandwich: 'Beef Fajita Wrap filled with Cheese and Salsa',
      },
      {
        day: 'Wednesday',
        main_meal: 'Overnight slow cooked Brisket layed on a bed of Pasta Rice and served with Seasonal Roast Vegetables',
        vegetarian_meal: 'Palak Paneer Curry served with Basmati Rice and Roti',
        healthy_meal: 'Baked Jacket Potato topped with Savoury Mince and served with Ginger infused Broccoli',
        curry_of_the_day: 'Madras Lamb Curry served with Basmati Rice',
        gourmet_sandwich: 'Panini filled with Meatballs, Napolitana sauce and Mozzarella',
      },
      {
        day: 'Thursday',
        main_meal: 'Chicken Drumstick served with Mash Potato, Homemade Gravy and Dill Baby Marrow',
        vegetarian_meal: 'Asian Tofu Chow Mein',
        healthy_meal: 'Asian Beef Chop Suey',
        curry_of_the_day: 'Tumeric Coconut Lime Chicken Curry served with Jasmin Rice',
        gourmet_sandwich: 'Lamb Shish Kebab Shawarma with all the trimmings',
      },
      {
        day: 'Friday',
        main_meal: 'Homemade Beef Pepper Steak Pie, Gravy and served with Coleslaw',
        vegetarian_meal: 'Seasonal Vegetable Pie served with Coleslaw',
        healthy_meal: 'Chicken Caesar Salad (Lettuce / Boiled Egg / Cucumber / Cherry Tomatoes / Macon / Croutons and Creamy Caesar Dressing)',
        curry_of_the_day: 'Mince Curry, Potato and Pea Curry served with Basmati Rice and Sambals',
        gourmet_sandwich: 'Beef Frankfurter Baguette with Coleslaw and Pickled Gherkins',
      },
    ],
  },
  {
    week: 3,
    days: [
      {
        day: 'Monday',
        main_meal: 'Chicken Pasta Bake served with a Side Salad',
        vegetarian_meal: 'Potato Dumplings with Mushroom and Pumpkin Sauce served with a Tomato and Olive Salad',
        healthy_meal: 'Beef, Roasted Vegetables and Couscous Salad',
        curry_of_the_day: 'Palak Paneer Curry served with Basmati Rice and Sambals',
        gourmet_sandwich: 'Panini filled with Grilled Chicken, Napolitana sauce, Mozzarella and Parmesan',
      },
      {
        day: 'Tuesday',
        main_meal: 'Chicken Schnitzel topped with Napoli Sauce served with Mash Potato and Side Green Salad',
        vegetarian_meal: 'Stuffed Butternut with Vegetable Ratatouille and topped with Feta Cheese',
        healthy_meal: 'Pulled Chicken and Vegetable Health Roll',
        curry_of_the_day: 'Tandoori Chicken served with Flatbread and Cabbage Salad',
        gourmet_sandwich: 'Cold Meat Salad and Greens filled Baguette',
      },
      {
        day: 'Wednesday',
        main_meal: 'Beef Stew served with Samp and Beans accompanied by a Beetroot Salad',
        vegetarian_meal: 'Vegetable Quiche and Greek Salad',
        healthy_meal: 'Grilled Deboned Chicken Thigh, Vegetable Fritters served with Spinach, Cabbage and Cherry Tomato Salad drizzled with a Creamy Dressing',
        curry_of_the_day: 'Slow Cooked Brisket Red Curry served with Jasmin Rice',
        gourmet_sandwich: 'Chicken Schnitzel, Humus and Salad filled Panini',
      },
      {
        day: 'Thursday',
        main_meal: 'Sticky Chicken Wings served with Roasted Sweet Potato and Asian slaw',
        vegetarian_meal: 'Melanzane and Roasted Sweet Potato',
        healthy_meal: 'Beef and Pumpkin Stir-Fry served on Courgette Pasta',
        curry_of_the_day: 'Butter Chicken Curry served with Basmati Rice',
        gourmet_sandwich: 'Chilli con carne Burrito',
      },
      {
        day: 'Friday',
        main_meal: 'Chinese Beef Short Rib served with Rice and Vegetables',
        vegetarian_meal: 'Vegetable Quesadilla served with Bean Salsa',
        healthy_meal: 'Beef Burger served on a Roasted Cauliflower Bun topped with a Tahini Dressing',
        curry_of_the_day: 'Roti with Bean and Potato Curry (2 x Roti per serving)',
        gourmet_sandwich: 'Spicy Potato, Chorizo and Cheese Wrap',
      },
    ],
  },
  {
    week: 4,
    days: [
      {
        day: 'Monday',
        main_meal: 'Mexican Chilli con carne, Cheese and Brown Rice Wrap with Salsa',
        vegetarian_meal: 'Roasted Seasonal Vegetable Wrap with Cream Cheese and Salsa',
        healthy_meal: 'Quarter Roast Chicken served with Vegetable Pasta Salad',
        curry_of_the_day: 'Potato and Peas Dry Curry with Spicy Paneer, Dhal and Roti',
        gourmet_sandwich: 'Macon & Egg Wrap with Gherkin Vegetables, Rocket and Aioli',
      },
      {
        day: 'Tuesday',
        main_meal: 'Rich Chicken Stew served with Mash and Seasonal Vegetables',
        vegetarian_meal: 'Butternut Masala served with Rice',
        healthy_meal: 'Poke Bowl (Boiled Egg, Humus, Aubergine, Tomato, Cucumber, Corn, Spinach and Signature Dressing)',
        curry_of_the_day: 'Fragrant Beef Vindaloo served with Basmati Rice',
        gourmet_sandwich: 'Roast Chicken, Chimichurri and Salad Panini',
      },
      {
        day: 'Wednesday',
        main_meal: 'Beef Chuck, Pap and Gravy',
        vegetarian_meal: 'Spinach and Feta Pie served with a Side Salad',
        healthy_meal: 'Meatball cooked in napolitana sauce and served on Brown Rice & Lentils (Served with a side salad)',
        curry_of_the_day: 'Lamb Korma served with Basmati Rice',
        gourmet_sandwich: 'Beef Chorizo Baguette filled with Aioli and Salad',
      },
      {
        day: 'Thursday',
        main_meal: 'Butter Chicken Curry served with Basmati Rice',
        vegetarian_meal: 'Chickpea and Vegetable Stew served with Couscous',
        healthy_meal: 'Portuguese Marinated Grilled Chicken Fillet served with a side of Potato Salad and Roasted Beetroot',
        curry_of_the_day: 'Thai Green Chicken Curry served with Jasmin Rice',
        gourmet_sandwich: 'Chicken Schnitzel Pita with Humus, Matbucha, Salad Greens and Tahini Drizzle',
      },
      {
        day: 'Friday',
        main_meal: 'Beef Prego roll filled with fried onions and served with a side of Potato Wedges',
        vegetarian_meal: 'Haloumi Prego roll filled with fried onions and served with a side of Potato Wedges',
        healthy_meal: 'Chicken and Roasted Vegetables Pasta Salad',
        curry_of_the_day: 'Chicken Biryani accompanied by a Yoghurt Sauce',
        gourmet_sandwich: 'Macon, Avo, Feta, Olive and Greens filled Panini',
      },
    ],
  },
  {
    week: 5,
    days: [
      {
        day: 'Monday',
        main_meal: 'Beef Goulash served with Mashed Potato and Pumpkin Salad',
        vegetarian_meal: 'Vegetable Tart served with a side Salad',
        healthy_meal: 'Chicken Strips and Pearl Couscous Salad',
        curry_of_the_day: 'Japanese Beef curry served with Short Grain Japanese Rice',
        gourmet_sandwich: 'Wafer thin Chicken Baguette topped with mustard, Gherkins and Rocket',
      },
      {
        day: 'Tuesday',
        main_meal: 'Sweet Chilli Chicken Schnitzel Wrap with Aioli and Greens served with Potato Salad',
        vegetarian_meal: 'Roasted Seasonal Vegetable Panini filled with Mozzarella, Cream Cheese, Cucumber, Tomato, Lettuce and Pesto',
        healthy_meal: 'Beef Chop Suey (Jasmine Rice)',
        curry_of_the_day: 'Durban Chicken Curry served with Basmati Rice - Chilli available under sides',
        gourmet_sandwich: 'Panini Filled with Deboned Grilled Chicken Thighs, Humus and Salad',
      },
      {
        day: 'Wednesday',
        main_meal: 'Chicken Thigh Curry served with Pap and Beetroot Salad',
        vegetarian_meal: 'Courgette Cheesy Pasta Bake served with a side salad',
        healthy_meal: 'Grilled Cajun Chicken, Herbs, Aioli and Vegetable Baguette',
        curry_of_the_day: 'Lamb Rogan Josh served with Basmati Rice',
        gourmet_sandwich: 'Panini filled with Meatballs, Napolitana sauce and Mozzarella',
      },
      {
        day: 'Thursday',
        main_meal: 'Beef Pastitsio and Salad',
        vegetarian_meal: 'Pea and Vegetable Fritters served with a side Salad and Tzatziki',
        healthy_meal: 'Quarter Chicken served with Baby Potatoes and a side Salad',
        curry_of_the_day: 'Sri Lankan Chicken Curry served with Jasmin Rice and Sambals',
        gourmet_sandwich: 'Creamy Cheese and Garlic Chicken Baguette',
      },
      {
        day: 'Friday',
        main_meal: 'Boerewors Roll with Fried Onion, Sauces and served with Potato Wedges',
        vegetarian_meal: 'Baked Potato with Vegetable Ratatouille topped with Cheese',
        healthy_meal: 'Roast Beef Salad with cabbage, Greens, Tomato and Peanut Dressing',
        curry_of_the_day: 'Thai Massaman Mince Curry served with Jasmin Rice and topped with a Fried Egg',
        gourmet_sandwich: 'Falafel Shawarma with all the trimmings',
      },
    ],
  },
  {
    week: 6,
    days: [
      {
        day: 'Monday',
        main_meal: 'Vietnamese Lemon Grass Chicken Rice Noodles with Herbs and Vegetable Salad',
        vegetarian_meal: 'Onion and Leek Cake served with Chunky Potato and a Rocket Herb Salad',
        healthy_meal: 'Beef Shawarma with all the trimmings. Served with Potato Wedges',
        curry_of_the_day: 'Durban Beef Curry served with Basmati Rice',
        gourmet_sandwich: 'Smoked Chicken Baguette filled with Coleslaw and Avo',
      },
      {
        day: 'Tuesday',
        main_meal: 'Beef Bourguignon (Beef, Mushroom, Baby Onion, Potato, Macon and Red Wine Stew)',
        vegetarian_meal: 'Butternut and Courgette Butter Curry served with Basmati Rice and sambals',
        healthy_meal: 'Roasted Chicken Thighs resting on a bed of couscous and served with Chickpeas, Pumpkin and Courgettes',
        curry_of_the_day: 'South India Fish Curry served with Basmati Rice',
        gourmet_sandwich: 'Pulled Chicken, Cheese and Salad Wrap',
      },
      {
        day: 'Wednesday',
        main_meal: 'Beef Cottage Pie served with a side Salad',
        vegetarian_meal: 'Ricotta, Grilled Vegetables, Sun-Dried Tomato and Olive Lasagne',
        healthy_meal: 'Brown Rice Chicken Salad with Cherry Tomato, Cucumber, Lettuce, Red Onion, Olives and drizzled with a vinaigrette',
        curry_of_the_day: 'Madras Lamb Curry served with Basmati Rice',
        gourmet_sandwich: 'Panini filled with Curried Mince, Chutney, Potato and Sambals',
      },
      {
        day: 'Thursday',
        main_meal: 'Mutton Curry served with Samp & Beans accompanied by a Spicy Tomato, Carrot & Onion Sambal',
        vegetarian_meal: 'Roasted Cauliflower served on a bed of Basmati Rice topped with a Tomato and Basil Sauce served with a Lentil Salad',
        healthy_meal: 'Chicken, Spinach, Pesto and Feta Wrap served with a Corn, Mushroom and Dill Salad',
        curry_of_the_day: 'Tumeric Coconut Lime Chicken Curry served with Jasmin Rice',
        gourmet_sandwich: 'Tuna Mayonnaise, Olive, Lettuce, Tomato and Cucumber Baguette',
      },
      {
        day: 'Friday',
        main_meal: 'Middle Eastern Spicy Chicken Quarter topped with a herb salsa sauce on rice and Roasted Vegetables',
        vegetarian_meal: 'Lentils and Potato Stew served with a side Salad',
        healthy_meal: 'Panini filled with Italian Pulled Beef, Pesto Mayo, Olive, Tomato and a Parsley Garlic Dressing',
        curry_of_the_day: 'Mince, Potato and Pea Curry served with Basmati Rice and Sambals',
        gourmet_sandwich: 'Chicken Shawarma with all the trimmings',
      },
    ],
  },
  {
    week: 7,
    days: [
      {
        day: 'Monday',
        main_meal: 'Beef Boerewors, Pap and Tomato Gravy',
        vegetarian_meal: 'Penne Arrabbiata served with Raw Carrot and Beetroot Salad',
        healthy_meal: 'Chicken, Broccoli and Green Bean Noodle Stir-Fry',
        curry_of_the_day: 'Palak Chicken Curry served with Basmati Rice and Sambals',
        gourmet_sandwich: 'Panini filled with Grilled Chicken, Napolitana sauce, Mozzarella and Parmesan',
      },
      {
        day: 'Tuesday',
        main_meal: 'South India Chicken Curry served with Basmati Rice and Sambals',
        vegetarian_meal: 'Vegetarian Poke Bowl with Corn, Chickpeas, Jasmin Rice, Cabbage, Cucumber, Lentils and Sweet Soy Dressing',
        healthy_meal: 'Sweet Potato, Butternut and Chicken Bake served with a side salad',
        curry_of_the_day: 'Tandoori Chicken served with Basmati Rice and Tomato Chutney',
        gourmet_sandwich: 'Cold Meat Salad and Greens filled Baguette',
      },
      {
        day: 'Wednesday',
        main_meal: 'Fried Fish and Wedges with a Creamy Lemon Garlic Sauce',
        vegetarian_meal: 'Panini Roll filled with Shakshuka, Feta and Olives',
        healthy_meal: 'Roast Lamb Souvlaki Wrap filled with Slow Roasted Marinated overnight Leg of Lamb, Tomato, Onion and Tzatziki',
        curry_of_the_day: 'Slow Cooked Brisket Red Curry served with Jasmin Rice',
        gourmet_sandwich: 'Chicken Schnitzel, Humus and Salad filled Panini',
      },
      {
        day: 'Thursday',
        main_meal: 'Beef Chuck served with Rice and Roasted Butternut',
        vegetarian_meal: 'White Bean Spinach Casserole served with Polenta Mash',
        healthy_meal: 'Egg Mayonnaise Thick Slice Sandwich topped with Gherkins, Spring Onion Cucumber. Served with a Side Greek Salad',
        curry_of_the_day: 'Butter Chicken Curry served with Basmati Rice',
        gourmet_sandwich: 'Chilli con carne Burrito',
      },
      {
        day: 'Friday',
        main_meal: 'Fried Chicken served with Pap and Tomato Onion Relish',
        vegetarian_meal: 'Haloumi Shawarma with all the trimmings and Coleslaw',
        healthy_meal: 'Crispy Chicken, Mexican Salad, Cheese and Aioli on Nachos',
        curry_of_the_day: 'Roti with Bean and Potato Curry (2 x Roti per serving)',
        gourmet_sandwich: 'Spicy Potato, Chorizo and Cheese Wrap',
      },
    ],
  },
  {
    week: 8,
    days: [
      {
        day: 'Monday',
        main_meal: 'Roast chicken served with Roast Potato, Seasonal vegetables and Gravy',
        vegetarian_meal: 'Vegetable Ratatouille served on Rice',
        healthy_meal: 'Tandoori Mango Atchar Deboned Chicken Thigh Flat Bread with Sambals',
        curry_of_the_day: 'Potato and Peas Dry Curry with Spicy Paneer, Dhal and Roti',
        gourmet_sandwich: 'Macon & Egg Wrap with Gherkin Vegetables and Aioli',
      },
      {
        day: 'Tuesday',
        main_meal: 'Rich Beef Stew served with Rice and Roast Pumpkin',
        vegetarian_meal: 'Potato, Peas and Herb Cakes with a village Greek Salad',
        healthy_meal: 'Chicken, White Bean and Spinach Casserole served with Polenta Mash',
        curry_of_the_day: 'Fragrant Beef Vindaloo served with Basmati Rice',
        gourmet_sandwich: 'Roast Chicken, Chimichurri and Salad Panini',
      },
      {
        day: 'Wednesday',
        main_meal: 'Chicken Schnitzel served with Mashed potatoes and a side Salad',
        vegetarian_meal: 'Cabbage and Potato Curry served with Rice and Sambals',
        healthy_meal: 'Chicken Kebab served with Sweet Potato Wedges and Coleslaw',
        curry_of_the_day: 'Lamb Korma served with Basmati Rice',
        gourmet_sandwich: 'Vietnamese Beef Baguette',
      },
      {
        day: 'Thursday',
        main_meal: 'Sweet Chilli Chicken Drumstick served on Egg Noodles and Vegetables',
        vegetarian_meal: 'Tempura Vegetables served with Jasmine Rice and a side Salad',
        healthy_meal: 'Chicken Fillet, Vegetables and herbs Quinoa Bowl',
        curry_of_the_day: 'Thai Green Chicken Curry served with Jasmin Rice',
        gourmet_sandwich: 'Macon, Avo, Feta, Olive and Greens filled Panini',
      },
      {
        day: 'Friday',
        main_meal: 'Creamy Tomato Chicken and Mushroom Pie served with a side Salad',
        vegetarian_meal: 'Vegetable Burger served with Potato Wedges',
        healthy_meal: 'Roast Beef Baguette filled with Roast Beef, Mayonnaise, Lettuce, Roasted Tomato and Onion. Served with a side Salad',
        curry_of_the_day: 'Chicken Biryani accompanied by a Yoghurt Sauce',
        gourmet_sandwich: 'Chicken Schnitzel Pita with Humus, Matbucha, Salad Greens and Tahini Drizzle',
      },
    ],
  },
];

// Helper to determine day name ('Monday' - 'Friday') from a YYYY-MM-DD string
export function getWeekdayNameFromDate(dateString: string): 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Weekend' {
  if (!dateString) return 'Monday';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayIndex = d.getDay();
    const days: ('Weekend' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Weekend')[] = [
      'Weekend', // Sun
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Weekend', // Sat
    ];
    const res = days[dayIndex];
    return res === 'Weekend' ? 'Monday' : res;
  }
  return 'Monday';
}

// Helper to dynamically calculate the 1-8 cycle week based on base active week and target date offset
export function getCycleWeekForDate(baseWeekNumber: number = 1, targetDateString?: string): number {
  if (!targetDateString) return baseWeekNumber;
  try {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const parts = targetDateString.split('-');
    if (parts.length !== 3) return baseWeekNumber;
    const targetMidnight = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

    // Today's day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const todayDay = now.getDay();
    const daysSinceMonday = todayDay === 0 ? 6 : todayDay - 1;
    const currentWeekMonday = new Date(
      todayMidnight.getFullYear(),
      todayMidnight.getMonth(),
      todayMidnight.getDate() - daysSinceMonday
    );

    // Once Thursday 11:59 AM cutoff has passed (or on Fri/Sat/Sun), the current calendar week has no orderable days left,
    // so the active base rotation week applies to the upcoming Monday-Friday ordering week.
    const isCurrentWeekClosed =
      daysSinceMonday > 3 ||
      (daysSinceMonday === 3 && (now.getHours() > 11 || (now.getHours() === 11 && now.getMinutes() >= 59)));

    const anchorMonday = isCurrentWeekClosed
      ? new Date(currentWeekMonday.getFullYear(), currentWeekMonday.getMonth(), currentWeekMonday.getDate() + 7)
      : currentWeekMonday;

    const diffDays = Math.round((targetMidnight.getTime() - anchorMonday.getTime()) / (1000 * 60 * 60 * 24));
    const weekOffset = Math.floor(diffDays / 7);

    // Compute cycle week in 1..8 range
    const effectiveWeek = (((baseWeekNumber - 1) + Math.max(0, weekOffset)) % 8) + 1;
    return effectiveWeek;
  } catch (e) {
    return baseWeekNumber;
  }
}

// Generate the 5 Chef's Choice dishes for a given week and date (using live DB cycle plans when provided)
export function getChefsChoiceDishesForDate(
  baseWeekNumber: number,
  dateString: string,
  customCyclePlans?: CycleWeekPlan[]
): MenuItem[] {
  const weekNumber = getCycleWeekForDate(baseWeekNumber, dateString);
  const sourcePlans =
    customCyclePlans && customCyclePlans.length > 0 ? customCyclePlans : EIGHT_WEEK_CYCLE_DATA;
  const weekData = sourcePlans.find((w) => w.week === weekNumber) || sourcePlans[0] || EIGHT_WEEK_CYCLE_DATA[0];
  const weekday = getWeekdayNameFromDate(dateString);
  const dayPlan = weekData.days.find((d) => d.day === weekday) || weekData.days[0];

  return [
    {
      id: `chef_${weekNumber}_${weekday}_main`,
      categoryId: 'cat_chefs_choice',
      name: 'Chef’s Main Meal of the Day',
      description: dayPlan.main_meal,
      ingredients: 'Chef’s daily prepared ingredients, fresh seasonings & garnishes',
      dietaryTags: ['Halaal'],
      price: 80.0,
      prices: { standard: 80.0 },
      categoryName: `Chef's Choice (Week ${weekNumber})`,
      menuType: 'chefs_choice',
      isAvailable: true,
    },
    {
      id: `chef_${weekNumber}_${weekday}_veg`,
      categoryId: 'cat_chefs_choice',
      name: 'Chef’s Vegetarian Meal of the Day',
      description: dayPlan.vegetarian_meal,
      ingredients: 'Farm-fresh vegetables, pulses, cheeses & herbs',
      dietaryTags: ['Vegetarian'],
      price: 80.0,
      prices: { standard: 80.0 },
      categoryName: "Chef's Choice",
      menuType: 'chefs_choice',
      isAvailable: true,
    },
    {
      id: `chef_${weekNumber}_${weekday}_healthy`,
      categoryId: 'cat_chefs_choice',
      name: 'Chef’s Health Meal of the Day',
      description: dayPlan.healthy_meal,
      ingredients: 'Lean proteins, whole grains, steamed greens & superfoods',
      dietaryTags: ['Low Carb', 'Gluten-Free'],
      price: 80.0,
      prices: { standard: 80.0 },
      categoryName: "Chef's Choice",
      menuType: 'chefs_choice',
      isAvailable: true,
    },
    {
      id: `chef_${weekNumber}_${weekday}_curry`,
      categoryId: 'cat_chefs_choice',
      name: 'Curry of the Day',
      description: dayPlan.curry_of_the_day,
      ingredients: 'Slow-simmered spices, aromatic curry gravy, steamed rice & traditional sambals',
      dietaryTags: ['Halaal'],
      price: 80.0,
      prices: { standard: 80.0 },
      categoryName: "Chef's Choice",
      menuType: 'chefs_choice',
      isAvailable: true,
    },
    {
      id: `chef_${weekNumber}_${weekday}_sandwich`,
      categoryId: 'cat_chefs_choice',
      name: 'Gourmet Sandwich of the Day',
      description: dayPlan.gourmet_sandwich,
      ingredients: 'Artisan freshly baked bread, premium fillings, gourmet relishes & crisp greens',
      dietaryTags: [],
      price: 80.0,
      prices: { standard: 80.0 },
      categoryName: "Chef's Choice",
      menuType: 'chefs_choice',
      isAvailable: true,
    },
  ];
}

// Common side add-ons used for wraps, hot dogs, sandwiches, burger bar
const SIDES_ADD_ONS = [
  { name: 'Cheese Sauce', price: 35.0 },
  { name: 'Cheesy Jalapeno Sauce', price: 35.0 },
  { name: 'Mushroom Sauce', price: 35.0 },
  { name: 'Potato Wedges', price: 35.0 },
  { name: 'Sweet Potato Wedges', price: 35.0 },
  { name: 'Asian Slaw', price: 20.0 },
  { name: 'Coleslaw', price: 20.0 },
  { name: 'Village Greek Salad', price: 25.0 },
  { name: 'Green Salad', price: 20.0 },
  { name: 'Potato Salad', price: 25.0 },
];

// ============================================================================
// STANDARD CLASSIC MENU CATEGORIES (FROM CLIENT SPECIFICATIONS)
// ============================================================================
export const MENU_CATEGORIES: MenuCategory[] = [
  // 1. CIAO ITALY
  {
    id: 'cat_ciao_italy',
    name: 'CIAO ITALY',
    slug: 'ciao-italy',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 1,
    isActive: true,
    addOns: [
      { name: 'Extra Parmesan Cheese', price: 25.0 },
      { name: 'Extra Mozzarella', price: 25.0 },
      { name: 'Extra Macon', price: 30.0 },
    ],
  },
  // 2. SALAD BAR
  {
    id: 'cat_salad_bar',
    name: 'SALAD BAR',
    slug: 'salad-bar',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 2,
    isActive: true,
    addOns: [
      { name: 'Grilled Chicken', price: 30.0 },
      { name: 'Grilled Halloumi', price: 30.0 },
      { name: 'Grilled Sirloin Steak 150g', price: 95.0 },
      { name: 'Danish Feta', price: 20.0 },
    ],
  },
  // 3. POKE BOWL
  {
    id: 'cat_poke_bowl',
    name: 'POKE BOWL',
    slug: 'poke-bowl',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 3,
    isActive: true,
    addOns: [
      { name: 'Grilled Chicken', price: 30.0 },
      { name: 'Grilled Halloumi', price: 30.0 },
      { name: 'Grilled Sirloin Steak 150g', price: 95.0 },
      { name: 'Danish Feta', price: 20.0 },
    ],
  },
  // 4. STIR FRY
  {
    id: 'cat_stir_fry',
    name: 'STIR FRY',
    slug: 'stir-fry',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 4,
    isActive: true,
    addOns: [
      { name: 'Extra Chicken', price: 30.0 },
      { name: 'Extra Beef', price: 45.0 },
      { name: 'Extra Tofu', price: 25.0 },
    ],
  },
  // 5. WRAPS (Low-GI wraps, Gluten free bread)
  {
    id: 'cat_wraps',
    name: 'WRAPS',
    slug: 'wraps',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 5,
    isActive: true,
    addOns: [
      { name: 'Wrap: Low-GI Wrap', price: 0.0 },
      { name: 'Wrap: Gluten Free Bread', price: 0.0 },
      ...SIDES_ADD_ONS,
    ],
  },
  // 6. SANDWICHES (Bread options: Seeded, Sour Dough, Panini, Mini Baguette, Focaccia, Pita, Gluten free bread)
  {
    id: 'cat_sandwiches',
    name: 'SANDWICHES',
    slug: 'sandwiches',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 6,
    isActive: true,
    addOns: [
      { name: 'Bread: Gluten Free Bread', price: 0.0 },
      { name: 'Bread: Seeded', price: 0.0 },
      { name: 'Bread: Sour Dough', price: 0.0 },
      { name: 'Bread: Panini', price: 0.0 },
      { name: 'Bread: Mini Baguette', price: 0.0 },
      { name: 'Bread: Focaccia', price: 0.0 },
      { name: 'Bread: Pita', price: 0.0 },
      ...SIDES_ADD_ONS,
    ],
  },
  // 7. HOT DOG SALOON
  {
    id: 'cat_hot_dogs',
    name: 'HOT DOG SALOON',
    slug: 'hot-dog-saloon',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 7,
    isActive: true,
    addOns: SIDES_ADD_ONS,
  },
  // 8. BURGER BAR
  {
    id: 'cat_burger_bar',
    name: 'BURGER BAR',
    slug: 'burger-bar',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 8,
    isActive: true,
    addOns: [
      { name: 'Cheese Sauce', price: 35.0 },
      { name: 'Cheesy Jalapeno Sauce', price: 35.0 },
      { name: 'Mushroom Sauce', price: 35.0 },
      ...SIDES_ADD_ONS,
      { name: 'Extra Beef Patty', price: 40.0 },
      { name: 'Extra Chicken Fillet', price: 35.0 },
      { name: 'Extra Halloumi', price: 45.0 },
      { name: 'Extra Cheese', price: 25.0 },
      { name: 'Extra Macon', price: 30.0 },
    ],
  },
  // 9. SIDES & SAUCES
  {
    id: 'cat_sides_sauces',
    name: 'SIDES & SAUCES',
    slug: 'sides-and-sauces',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 9,
    isActive: true,
    addOns: [],
  },
  // 10. FITNESS MEALS
  {
    id: 'cat_fitness_meals',
    name: 'FITNESS MEALS',
    slug: 'fitness-meals',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 10,
    isActive: true,
    addOns: [],
  },
  // 11. HOMEMADE WINTER SOUPS (Served with a Fresh Panini Roll and Butter)
  {
    id: 'cat_soups',
    name: 'HOMEMADE WINTER SOUPS',
    slug: 'homemade-winter-soups',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 11,
    isActive: true,
    addOns: [
      { name: 'Side: Fresh Panini Roll & Butter', price: 0.0 },
      { name: 'Side: Gluten Free Bread', price: 0.0 },
    ],
  },
  // 12. RAMEN BOWLS
  {
    id: 'cat_ramen_bowls',
    name: 'RAMEN BOWLS',
    slug: 'ramen-bowls',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 12,
    isActive: true,
    addOns: [
      { name: 'Extra Chilli Oil', price: 10.0 },
      { name: 'Extra Boiled Egg', price: 15.0 },
    ],
  },
  // 13. VEGAN MEALS
  {
    id: 'cat_vegan_meals',
    name: 'VEGAN MEALS',
    slug: 'vegan-meals',
    menuType: 'standard',
    heroImage: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 13,
    isActive: true,
    addOns: [],
  },
  // Chef's Choice Tab Category
  {
    id: 'cat_chefs_choice',
    name: "Chef's Choice Daily Specials",
    slug: 'chefs-choice-daily',
    menuType: 'chefs_choice',
    heroImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 14,
    isActive: true,
    addOns: [],
  },
];

/**
 * Returns the hero image associated with a given category ID or category name.
 * Every item in a category displays its category's hero image in popups and post-add previews.
 */
export function getCategoryHeroImage(categoryId?: string, categoryName?: string, dishName?: string): string {
  const catIdLower = (categoryId || '').toLowerCase();
  const catNameLower = (categoryName || '').toLowerCase();
  const dishLower = (dishName || '').toLowerCase();

  if (!catIdLower && !catNameLower && !dishLower) {
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=80';
  }

  const byId = MENU_CATEGORIES.find((c) => c.id.toLowerCase() === catIdLower);
  if (byId?.heroImage) return byId.heroImage;

  const byName = MENU_CATEGORIES.find(
    (c) =>
      c.name.toLowerCase() === catNameLower ||
      c.slug.toLowerCase() === catIdLower ||
      (catNameLower.length > 2 && c.name.toLowerCase().includes(catNameLower)) ||
      (catNameLower.length > 2 && catNameLower.includes(c.name.toLowerCase()))
  );
  if (byName?.heroImage) return byName.heroImage;

  // Match by dish name in MENU_ITEMS if categoryId was a database UUID
  if (dishLower) {
    const matchedDish = MENU_ITEMS.find((m) => m.name.toLowerCase() === dishLower);
    if (matchedDish) {
      const cat = MENU_CATEGORIES.find((c) => c.id === matchedDish.categoryId);
      if (cat?.heroImage) return cat.heroImage;
    }
  }

  const combined = `${catIdLower} ${catNameLower} ${dishLower}`;
  if (combined.includes('italy') || combined.includes('pasta') || combined.includes('lasagne') || combined.includes('penne') || combined.includes('spaghetti') || combined.includes('ravioli')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('salad')) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('poke')) {
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('stir fry') || combined.includes('stir-fry')) {
    return 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('wrap')) {
    return 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('sandwich') || combined.includes('panini') || combined.includes('baguette')) {
    return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('hot dog') || combined.includes('hot-dog')) {
    return 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('burger')) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('side') || combined.includes('sauce') || combined.includes('wedge')) {
    return 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('fitness')) {
    return 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('soup')) {
    return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('ramen')) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('vegan')) {
    return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&auto=format&fit=crop&q=80';
  }
  if (combined.includes('chef')) {
    return 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80';
  }

  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=80';
}

// Helper to build a standard MenuItem without marketing descriptions
function makeItem(
  id: string,
  categoryId: string,
  categoryName: string,
  name: string,
  standardPrice: number,
  largePrice?: number,
  dietaryTags: DietaryTag[] = [],
  ingredients: string = '',
  addOns?: { name: string; price: number }[]
): MenuItem {
  const cat = MENU_CATEGORIES.find((c) => c.id === categoryId);
  const effectiveAddOns = addOns !== undefined ? addOns : (cat?.addOns || []);
  const isVeg = name.includes('(V)') || dietaryTags.includes('Vegetarian') || dietaryTags.includes('Vegan');
  const tags: DietaryTag[] = isVeg && !dietaryTags.includes('Vegetarian') ? [...dietaryTags, 'Vegetarian'] : dietaryTags;

  return {
    id,
    categoryId,
    categoryName,
    name,
    description: '', // Strictly no descriptions as per client instructions
    ingredients,
    dietaryTags: tags,
    price: standardPrice,
    prices: largePrice ? { standard: standardPrice, large: largePrice } : { standard: standardPrice },
    addOns: effectiveAddOns,
    menuType: 'standard',
    isAvailable: true,
  };
}

// ============================================================================
// COMPLETE STANDARD CLASSIC MENU ITEMS (FROM CLIENT JSON SPECIFICATION)
// ============================================================================
export const MENU_ITEMS: MenuItem[] = [
  // 1. SALAD BAR (6 items)
  makeItem('item_sb_01', 'cat_salad_bar', 'SALAD BAR', 'Tuna Salad', 80.0, 140.0, ['Halaal'], 'Lettuce, Green Beans, Tomato, Cucumber, Boiled Baby Potato, Olives, Boiled egg, French dressing'),
  makeItem('item_sb_02', 'cat_salad_bar', 'SALAD BAR', 'Roasted Butternut Salad', 80.0, 120.0, ['Vegetarian', 'Gluten-Free'], 'Roasted Butternut, Danish Feta Cheese, Sundry Tomato, Roasted Cashew Nuts, Rocket, Quinoa Sprinkles, Basil, Maple Dressing'),
  makeItem('item_sb_03', 'cat_salad_bar', 'SALAD BAR', 'Grilled Chicken or Halloumi Chop Salad', 80.0, 130.0, ['Halaal'], 'Green and Red Cabbage, Roasted Cherry Tomato, Cucumber, Green Beans, Sweet Corn, Danish Feta Cheese, Chickpeas, Creamy Dressing'),
  makeItem('item_sb_04', 'cat_salad_bar', 'SALAD BAR', 'Thai Beef Noodle Salad', 80.0, 140.0, ['Halaal'], 'Marinated Pan-Fried Beef, Rice Noodles, Stir-fried Vegetables, Basil, Coriander, Sweet Soy Ginger Dressing'),
  makeItem('item_sb_05', 'cat_salad_bar', 'SALAD BAR', 'Cajun Chicken & Brown Rice Salad', 80.0, 130.0, ['Halaal', 'Gluten-Free'], 'Cherry tomatoes, Cucumber, Lettuce, Chopped Herbs, White Beans, Parsley Lemon Dressing'),
  makeItem('item_sb_06', 'cat_salad_bar', 'SALAD BAR', 'Roasted veg and couscous salad', 80.0, 120.0, ['Vegetarian'], 'Roasted Seasonal Vegetables, Wholewheat Couscous, Robiola Cheese, Orange Honey Balsamic Dressing'),

  // 2. POKE BOWL (4 items)
  makeItem('item_pb_01', 'cat_poke_bowl', 'POKE BOWL', 'Salmon', 140.0, 280.0, ['Gluten-Free'], 'Japanese Rice, Raw Salmon, Edamame Beans, Shredded Cabbage, Julienne Carrots, Cucumber, Green Beans, Cherry Tomatoes, Spring Onion, Sweet Wasabi Dressing'),
  makeItem('item_pb_02', 'cat_poke_bowl', 'POKE BOWL', 'Chicken Teriyaki', 80.0, 160.0, ['Halaal'], 'Japanese Rice, Teriyaki Chicken, Shredded Cabbage, Cucumber, Edamame Beans, Julienne Carrots, Cherry Tomatoes, Boiled Egg, Teriyaki Dressing'),
  makeItem('item_pb_03', 'cat_poke_bowl', 'POKE BOWL', 'Tinned Tuna', 80.0, 130.0, ['Halaal'], 'Japanese Rice, Tinned Tuna, Edamame Beans, Shredded Cabbage, Julienne Carrots, Cucumber, Green Beans, Cherry Tomatoes, Spring Onion, Creamy Soy Dressing'),
  makeItem('item_pb_04', 'cat_poke_bowl', 'POKE BOWL', 'High Protein', 80.0, 160.0, ['Halaal', 'Low Carb'], 'Grilled Chicken Breast, Boiled Egg, Steamed Broccoli, Green Salad, Beans, Lentils, Light Dressing'),

  // 3. STIR FRY (3 items)
  makeItem('item_sf_01', 'cat_stir_fry', 'STIR FRY', 'Beef Stir-Fry', 80.0, 140.0, ['Halaal'], 'Asian Beef Stir-Fry tossed with Rice or Noodles'),
  makeItem('item_sf_02', 'cat_stir_fry', 'STIR FRY', 'Chicken Stir-Fry', 80.0, 130.0, ['Halaal'], 'Asian Chicken Stir-Fry tossed with Rice or Noodles'),
  makeItem('item_sf_03', 'cat_stir_fry', 'STIR FRY', 'Vegetarian Stir-Fry', 80.0, 120.0, ['Vegetarian'], 'Vegetable and Tofu Stir-Fry tossed with Rice or Noodles'),

  // 4. CIAO ITALY (19 items)
  makeItem('item_ci_01', 'cat_ciao_italy', 'CIAO ITALY', 'Chicken Aglio e Olio Penne', 80.0, 140.0, ['Halaal'], 'Fresh Garlic, Olive Oil, Parmesan Cheese, Chicken'),
  makeItem('item_ci_02', 'cat_ciao_italy', 'CIAO ITALY', 'Spaghetti ala Courgette', 80.0, 120.0, ['Vegetarian'], 'Spaghetti aglio e olio, Courgette, Parmesan, Chilli Flakes'),
  makeItem('item_ci_03', 'cat_ciao_italy', 'CIAO ITALY', 'Penne Arrabbiata', 80.0, 120.0, ['Vegetarian'], 'A Spicy Italian pasta dish that packs a punch'),
  makeItem('item_ci_04', 'cat_ciao_italy', 'CIAO ITALY', 'Roasted Vegetable Penne', 80.0, 130.0, ['Vegetarian'], 'Penne Pasta, Roasted vegetables, Napolitana Sauce, Ricotta'),
  makeItem('item_ci_05', 'cat_ciao_italy', 'CIAO ITALY', 'Chicken Napolitana Penne', 80.0, 130.0, ['Halaal'], 'Chicken, Tomato-based Sauce, Herbs, Onions, Garlic'),
  makeItem('item_ci_06', 'cat_ciao_italy', 'CIAO ITALY', 'Spaghetti Meatballs', 80.0, 140.0, ['Halaal'], 'Spaghetti Pasta, Meatballs, Rich Tomato Gravy'),
  makeItem('item_ci_07', 'cat_ciao_italy', 'CIAO ITALY', 'Creamy Spinach and Feta Penne', 80.0, 130.0, ['Vegetarian'], 'Penne Pasta, Creamy spinach, Danish Feta Cheese'),
  makeItem('item_ci_08', 'cat_ciao_italy', 'CIAO ITALY', 'Chicken Alfredo Linguini Pasta', 80.0, 140.0, ['Halaal'], 'Tender grilled chicken slices, Linguini pasta, Butter, Heavy cream, Parmesan cheese, Garlic'),
  makeItem('item_ci_09', 'cat_ciao_italy', 'CIAO ITALY', 'Deboned Oxtail Risotto', 120.0, 200.0, ['Halaal'], 'Slow-braised gelatinous oxtail meat, Risotto rice'),
  makeItem('item_ci_10', 'cat_ciao_italy', 'CIAO ITALY', 'Porcini Mushroom Risotto', 80.0, 120.0, ['Vegetarian'], 'Traditional luxurious Italian rice dish'),
  makeItem('item_ci_11', 'cat_ciao_italy', 'CIAO ITALY', 'Spaghetti Bolognese', 80.0, 140.0, ['Halaal'], 'Thick rich Bolognese'),
  makeItem('item_ci_12', 'cat_ciao_italy', 'CIAO ITALY', 'Spaghetti Cacio e pepe Carbonara', 80.0, 140.0, ['Vegetarian'], 'Parmesan Cheese, Egg Yolk, Pepper, Creamy Sauce'),
  makeItem('item_ci_13', 'cat_ciao_italy', 'CIAO ITALY', 'Chicken Pesto Penne', 80.0, 140.0, ['Halaal'], 'Grilled Chicken, Basil Pesto, Dash of Cream'),
  makeItem('item_ci_14', 'cat_ciao_italy', 'CIAO ITALY', 'Butternut Napolitana Ravioli', 80.0, 140.0, ['Vegetarian'], 'Butternut Ravioli, Tomato-based Sauce, Herbs, Onions, Garlic'),
  makeItem('item_ci_15', 'cat_ciao_italy', 'CIAO ITALY', 'Beef Lasagne', 80.0, 140.0, ['Halaal'], 'Savoury Bolognese Sauce, Creamy Béchamel Sauce, Pasta Sheets, Melted Cheese'),
  makeItem('item_ci_16', 'cat_ciao_italy', 'CIAO ITALY', 'Macaroni Cheese and Macon', 80.0, 120.0, ['Halaal'], 'Macaroni pasta, Rich creamy cheese sauce, Macon'),
  makeItem('item_ci_17', 'cat_ciao_italy', 'CIAO ITALY', 'Aubergine and Courgette Lasagne', 80.0, 140.0, ['Vegetarian'], 'Aubergine, Courgette, Creamy Béchamel Sauce, Pasta Sheets, Melted Cheese'),
  makeItem('item_ci_18', 'cat_ciao_italy', 'CIAO ITALY', 'Mafia Gnocchi', 80.0, 140.0, ['Halaal'], 'Creamy Bolognaise, Mushroom, Chilli'),
  makeItem('item_ci_19', 'cat_ciao_italy', 'CIAO ITALY', 'Creamy Lemon Prawn & Calamari Spaghetti', 145.0, 300.0, ['Halaal'], 'Spaghetti, Prawns, Calamari, Zesty Lemon Cream Sauce'),

  // 5. WRAPS (5 items)
  makeItem('item_wr_01', 'cat_wraps', 'WRAPS', 'Middle Eastern', 80.0, undefined, ['Halaal'], 'Chicken, Humus, Herb salad, Tahini, Lentils'),
  makeItem('item_wr_02', 'cat_wraps', 'WRAPS', 'Mexican Grilled Chicken', 80.0, undefined, ['Halaal'], 'Grilled Chicken, Honey Mustard Aioli, Lettuce, Cucumber, Spring onion, Spicy Beans'),
  makeItem('item_wr_03', 'cat_wraps', 'WRAPS', 'BBQ Beef Wrap', 80.0, undefined, ['Halaal'], 'BBQ Beef Strips, Roasted Garlic Aioli, Gherkins, Coleslaw, Roasted Sweet Potato'),
  makeItem('item_wr_04', 'cat_wraps', 'WRAPS', 'Salmon Wholewheat Wrap', 80.0, undefined, [], 'Smoked Salmon, Cream Cheese, Onion, Capers, Herb Salad'),
  makeItem('item_wr_05', 'cat_wraps', 'WRAPS', 'Halloumi Wrap', 80.0, undefined, ['Vegetarian'], 'Halloumi, Roasted Vegetables, Herbs, Honey Mustard Aioli, Spicy Beans'),

  // 6. SANDWICHES (12 items)
  makeItem('item_sw_01', 'cat_sandwiches', 'SANDWICHES', 'Grilled Chicken', 80.0, undefined, ['Halaal'], 'Grilled Chicken, Honey Mustard Aioli, Lettuce, Cucumber, Spring onion'),
  makeItem('item_sw_02', 'cat_sandwiches', 'SANDWICHES', 'Egg Mayonnaise', 80.0, undefined, ['Vegetarian'], 'Egg Mayonnaise, Lettuce, Gherkins, Roasted Peppers'),
  makeItem('item_sw_03', 'cat_sandwiches', 'SANDWICHES', 'Roast Beef', 80.0, undefined, ['Halaal'], 'Roast Beef, Roasted Garlic Aioli, Tomato Jam, Rocket'),
  makeItem('item_sw_04', 'cat_sandwiches', 'SANDWICHES', 'Napoli', 80.0, undefined, [], 'Napoli Salami, Sweet Provolone, Grilled Marinaded Vegetables'),
  makeItem('item_sw_05', 'cat_sandwiches', 'SANDWICHES', 'Wafer Thin Chicken Roll', 80.0, undefined, ['Halaal'], 'Wafer thin Chicken Roll, Aioli, Cheddar Cheese, Sundried Tomato, Salad'),
  makeItem('item_sw_06', 'cat_sandwiches', 'SANDWICHES', 'Goat Cheese', 80.0, undefined, ['Vegetarian'], 'Goat Cheese, Tomato, Parsley Pesto, Cucumber'),
  makeItem('item_sw_07', 'cat_sandwiches', 'SANDWICHES', 'Middle Eastern', 80.0, undefined, ['Halaal'], 'Chicken, Tahini butter, humus, grilled veg, herb salad'),
  makeItem('item_sw_08', 'cat_sandwiches', 'SANDWICHES', 'Jersey Milk Lamb Prosciutto', 90.0, undefined, ['Halaal'], 'Jersey Milk Cheese, Lamb Prosciutto, Wild Rocket, Mature Balsamic Drizzle'),
  makeItem('item_sw_09', 'cat_sandwiches', 'SANDWICHES', 'Chicken Mayonnaise', 80.0, undefined, ['Halaal'], 'Chicken Mayonnaise, Seasoning'),
  makeItem('item_sw_10', 'cat_sandwiches', 'SANDWICHES', 'Macon, Egg, Cheese & Tomato', 80.0, undefined, ['Halaal'], 'Macon, Egg, Cheese, Tomato'),
  makeItem('item_sw_11', 'cat_sandwiches', 'SANDWICHES', 'Macon, Cheese and Tomato', 80.0, undefined, ['Halaal'], 'Macon, Cheese, Tomato'),
  makeItem('item_sw_12', 'cat_sandwiches', 'SANDWICHES', 'Cheese and Tomato', 80.0, undefined, ['Vegetarian'], 'Cheese, Tomato'),

  // 7. HOT DOG SALOON (3 items)
  makeItem('item_hd_01', 'cat_hot_dogs', 'HOT DOG SALOON', 'Mexican Beef Hot Dog', 80.0, undefined, ['Halaal'], 'Chorizo Beef Hot Dog, Mexican Salsa, Chimichurri Sauce, Cheese'),
  makeItem('item_hd_02', 'cat_hot_dogs', 'HOT DOG SALOON', 'Beef Hot Dog', 80.0, undefined, ['Halaal'], 'Beef Hot Dog, Honey Mustard Aioli, Fried Onion, Tomato Sauce'),
  makeItem('item_hd_03', 'cat_hot_dogs', 'HOT DOG SALOON', 'French Beef Hot Dog', 80.0, undefined, ['Halaal'], 'Beef Hot Dog, Aioli, Mustard, Homemade pickled Gherkins, Baguette'),

  // 8. BURGER BAR (2 items)
  makeItem('item_bb_01', 'cat_burger_bar', 'BURGER BAR', 'Classic Burger', 80.0, undefined, ['Halaal'], '150g Beef Patty or 150g Grilled Chicken Fillet Burger or Halloumi, Aioli Special Sauce, Sliced Tomato, Gherkins, Lettuce'),
  makeItem('item_bb_02', 'cat_burger_bar', 'BURGER BAR', 'Cheese Burger', 80.0, undefined, ['Halaal'], '150g Beef Patty or 150g Grilled Chicken Fillet Burger or Halloumi, Cheese, Aioli Special Sauce, Sliced Tomato, Gherkins, Lettuce'),

  // 9. SIDES & SAUCES (10 items)
  makeItem('item_ss_01', 'cat_sides_sauces', 'SIDES & SAUCES', 'Cheese Sauce', 35.0, undefined, ['Vegetarian'], 'Rich creamy cheddar cheese sauce'),
  makeItem('item_ss_02', 'cat_sides_sauces', 'SIDES & SAUCES', 'Cheesy Jalapeno Sauce', 35.0, undefined, ['Vegetarian'], 'Spicy cheesy jalapeno dipping sauce'),
  makeItem('item_ss_03', 'cat_sides_sauces', 'SIDES & SAUCES', 'Mushroom Sauce', 35.0, undefined, ['Vegetarian'], 'Creamy sauteed mushroom herb sauce'),
  makeItem('item_ss_04', 'cat_sides_sauces', 'SIDES & SAUCES', 'Potato Wedges', 35.0, undefined, ['Vegetarian'], 'Crispy roasted potato wedges with rosemary salt'),
  makeItem('item_ss_05', 'cat_sides_sauces', 'SIDES & SAUCES', 'Sweet Potato Wedges', 35.0, undefined, ['Vegetarian', 'Gluten-Free'], 'Oven-baked sweet potato wedges'),
  makeItem('item_ss_06', 'cat_sides_sauces', 'SIDES & SAUCES', 'Asian Slaw', 20.0, undefined, ['Vegetarian', 'Vegan'], 'Crisp shredded cabbage, carrot, and sesame ginger dressing'),
  makeItem('item_ss_07', 'cat_sides_sauces', 'SIDES & SAUCES', 'Coleslaw', 20.0, undefined, ['Vegetarian'], 'Fresh red and white cabbage in creamy home dressing'),
  makeItem('item_ss_08', 'cat_sides_sauces', 'SIDES & SAUCES', 'Village Greek Salad', 25.0, undefined, ['Vegetarian'], 'Tomato, cucumber, olives, and Danish feta'),
  makeItem('item_ss_09', 'cat_sides_sauces', 'SIDES & SAUCES', 'Green Salad', 20.0, undefined, ['Vegetarian', 'Vegan', 'Gluten-Free'], 'Crisp lettuce, cucumber ribbons, and light herb dressing'),
  makeItem('item_ss_10', 'cat_sides_sauces', 'SIDES & SAUCES', 'Potato Salad', 25.0, undefined, ['Vegetarian'], 'Diced baby potatoes in home dressing'),

  // 10. FITNESS MEALS (6 items)
  makeItem('item_fm_01', 'cat_fitness_meals', 'FITNESS MEALS', 'Grilled Chicken Fillet served with Sweet Potato and Broccoli', 80.0, undefined, ['Halaal', 'Gluten-Free', 'Low Carb'], 'Grilled Chicken Fillet, Sweet Potato, Broccoli'),
  makeItem('item_fm_02', 'cat_fitness_meals', 'FITNESS MEALS', 'Grilled Chicken Fillet served with Brown Rice and Broccoli', 80.0, undefined, ['Halaal', 'Gluten-Free'], 'Grilled Chicken Fillet, Brown Rice, Broccoli'),
  makeItem('item_fm_03', 'cat_fitness_meals', 'FITNESS MEALS', 'Grilled Chicken Fillet served with Broccoli and Seasonal Vegetables', 80.0, undefined, ['Halaal', 'Gluten-Free', 'Low Carb'], 'Grilled Chicken Fillet, Broccoli, Seasonal Vegetables'),
  makeItem('item_fm_04', 'cat_fitness_meals', 'FITNESS MEALS', 'Grilled Beef Fillet served with Sweet Potato and Broccoli', 130.0, undefined, ['Halaal', 'Gluten-Free', 'Low Carb'], 'Grilled Beef Fillet, Sweet Potato, Broccoli'),
  makeItem('item_fm_05', 'cat_fitness_meals', 'FITNESS MEALS', 'Grilled Beef Fillet served with Brown Rice and Broccoli', 130.0, undefined, ['Halaal', 'Gluten-Free'], 'Grilled Beef Fillet, Brown Rice, Broccoli'),
  makeItem('item_fm_06', 'cat_fitness_meals', 'FITNESS MEALS', 'Grilled Beef Fillet served with Broccoli and Seasonal Vegetables', 130.0, undefined, ['Halaal', 'Gluten-Free', 'Low Carb'], 'Grilled Beef Fillet, Broccoli, Seasonal Vegetables'),

  // 11. HOMEMADE WINTER SOUPS (3 items)
  makeItem('item_sp_01', 'cat_soups', 'HOMEMADE WINTER SOUPS', 'Ginger & Honey Butternut Soup', 80.0, 120.0, ['Vegetarian', 'Gluten-Free'], 'Slow-roasted butternut, fresh ginger, golden honey, vegetable stock, cream'),
  makeItem('item_sp_02', 'cat_soups', 'HOMEMADE WINTER SOUPS', 'Pea, Tomato & Lentil Soup', 80.0, 120.0, ['Vegan', 'Vegetarian', 'Gluten-Free'], 'Garden green peas, crushed plum tomatoes, brown lentils, fragrant herbs'),
  makeItem('item_sp_03', 'cat_soups', 'HOMEMADE WINTER SOUPS', 'Barley and Vegetable Soup', 80.0, 120.0, ['Vegan', 'Vegetarian'], 'Pearl barley, root vegetables, celery, leeks, aromatic herb broth'),

  // 12. RAMEN BOWLS (3 items)
  makeItem('item_rb_01', 'cat_ramen_bowls', 'RAMEN BOWLS', 'Pulled Chicken', 80.0, 160.0, ['Halaal'], 'Pulled Chicken, Noodles, Vegetables, Chicken Broth, Chilli Oil on the side'),
  makeItem('item_rb_02', 'cat_ramen_bowls', 'RAMEN BOWLS', 'Slow Cooked Brisket', 80.0, 160.0, ['Halaal'], 'Slow Cooked Brisket, Noodles, Vegetables, Marrow Bone Broth, Chilli Oil on the side'),
  makeItem('item_rb_03', 'cat_ramen_bowls', 'RAMEN BOWLS', 'Tofu and Vegetable', 80.0, 160.0, ['Vegetarian', 'Vegan'], 'Tofu, Noodles, Vegetables, Vegetable Broth, Chilli Oil on the side'),

  // 13. VEGAN MEALS (13 items)
  makeItem('item_vm_01', 'cat_vegan_meals', 'VEGAN MEALS', 'Roasted Butternut Salad', 80.0, 120.0, ['Vegan', 'Vegetarian', 'Gluten-Free'], 'Roasted Butternut, Sundry Tomato, Roasted Cashew Nuts, Rocket, Quinoa Sprinkles, Basil, Maple Dressing'),
  makeItem('item_vm_02', 'cat_vegan_meals', 'VEGAN MEALS', 'Roasted Vegetable and Couscous Salad', 80.0, 120.0, ['Vegan', 'Vegetarian'], 'Roasted Seasonal Vegetables, Wholewheat Couscous, Orange Honey Balsamic Dressing'),
  makeItem('item_vm_03', 'cat_vegan_meals', 'VEGAN MEALS', 'Green Salad', 80.0, 120.0, ['Vegan', 'Vegetarian', 'Gluten-Free'], 'Mixed fresh garden greens, cucumber ribbons, cherry tomatoes, house vinaigrette'),
  makeItem('item_vm_04', 'cat_vegan_meals', 'VEGAN MEALS', 'Potato Salad tossed in a Vinaigrette Dressing', 80.0, 120.0, ['Vegan', 'Vegetarian', 'Gluten-Free'], 'Baby potatoes, fresh chopped chives, tangy French vinaigrette dressing'),
  makeItem('item_vm_05', 'cat_vegan_meals', 'VEGAN MEALS', 'Spaghetti ala Courgette Pasta', 80.0, 120.0, ['Vegan', 'Vegetarian'], 'Spaghetti aglio e olio Courgette, Chilli Flakes'),
  makeItem('item_vm_06', 'cat_vegan_meals', 'VEGAN MEALS', 'Penne Arrabbiata Pasta', 80.0, 120.0, ['Vegan', 'Vegetarian'], 'Spicy Italian pasta dish'),
  makeItem('item_vm_07', 'cat_vegan_meals', 'VEGAN MEALS', 'Roasted Vegetable Penne', 80.0, 130.0, ['Vegan', 'Vegetarian'], 'Penne Pasta, Roasted vegetables, Napolitana Sauce'),
  makeItem('item_vm_08', 'cat_vegan_meals', 'VEGAN MEALS', 'Butternut Napolitana Ravioli', 80.0, 140.0, ['Vegan', 'Vegetarian'], 'Butternut Ravioli, Tomato-based Sauce, Herbs, Onions, Garlic'),
  makeItem('item_vm_09', 'cat_vegan_meals', 'VEGAN MEALS', 'Aubergine and Courgette Lasagne', 80.0, 140.0, ['Vegan', 'Vegetarian'], 'Aubergine, Courgette, Tomato-based sauce, Pasta Sheets'),
  makeItem('item_vm_10', 'cat_vegan_meals', 'VEGAN MEALS', 'Vegetarian Stir-Fry', 80.0, 120.0, ['Vegan', 'Vegetarian'], 'Vegetable and Tofu Stir-Fry, Rice Noodles'),
  makeItem('item_vm_11', 'cat_vegan_meals', 'VEGAN MEALS', 'Mediterranean Poke Bowl', 80.0, 130.0, ['Vegan', 'Vegetarian'], 'Humus, Whole Chickpeas, Cucumber, Cherry Tomatoes, Tahini, Pita Bread'),
  makeItem('item_vm_12', 'cat_vegan_meals', 'VEGAN MEALS', 'Mediterranean Vegan Sandwich', 80.0, undefined, ['Vegan', 'Vegetarian'], 'Tomato, Basil, Cucumber, Roasted Peppers'),
  makeItem('item_vm_13', 'cat_vegan_meals', 'VEGAN MEALS', 'Humus & Roasted Vegetable Vegan Sandwich', 80.0, undefined, ['Vegan', 'Vegetarian'], 'Humus, Roasted Vegetables, Cherry Tomato'),
];

// Sample Initial Order History
export const MOCK_ORDER_HISTORY: OrderHistoryItem[] = [
  {
    id: 'ord_active_today',
    orderNumber: 'ORD-2026-0826-KCO',
    targetDeliveryDate: '2026-08-26',
    deliveryDateFormatted: 'Wednesday, 26 Aug 2026',
    deliverySlot: '12:00 PM Sharp',
    deliveryFloor: 'Floor 3 (Reception Pantry)',
    companyLocation: 'Intellect Design Arena • 11 Alice Lane, Building 1',
    items: [
      {
        id: 'ci_active_01',
        menuItem: MENU_ITEMS[0],
        quantity: 2,
        size: 'standard',
        allergyNotes: 'Severe peanut allergy',
        targetDeliveryDate: '2026-08-26',
        unitPrice: 80.0,
        totalPrice: 160.0,
      },
    ],
    itemSubtotal: 160.0,
    deliveryFee: 0.0,
    vatAmount: 0.0,
    totalPaid: 160.0,
    paymentMethod: 'Instant EFT',
    paymentReference: 'PF-EFT-9941029',
    status: 'kitchen_prepping',
    stage: 2,
    createdAt: '2026-08-24T09:15:00Z',
    itnVerifiedAt: '2026-08-24T09:15:12Z',
    taxInvoiceNumber: 'INV-KC-2608-0826',
  },
  {
    id: 'ord_upcoming_01',
    orderNumber: 'ORD-2026-0902-KCO',
    targetDeliveryDate: '2026-09-02',
    deliveryDateFormatted: 'Wednesday, 02 Sep 2026',
    deliverySlot: '12:00 PM Sharp',
    deliveryFloor: 'Floor 3 (Reception Pantry)',
    companyLocation: 'Intellect Design Arena • 11 Alice Lane, Building 1',
    items: [
      {
        id: 'ci_up_01',
        menuItem: MENU_ITEMS[1],
        quantity: 1,
        size: 'standard',
        targetDeliveryDate: '2026-09-02',
        unitPrice: 80.0,
        totalPrice: 80.0,
      },
    ],
    itemSubtotal: 80.0,
    deliveryFee: 0.0,
    vatAmount: 0.0,
    totalPaid: 80.0,
    paymentMethod: 'Credit/Debit Card',
    paymentReference: 'PF-CC-4481021',
    status: 'paid_scheduled',
    stage: 1,
    createdAt: '2026-08-25T14:20:00Z',
    itnVerifiedAt: '2026-08-25T14:20:10Z',
    taxInvoiceNumber: 'INV-KC-2609-0902',
  },
  {
    id: 'ord_past_delivered_01',
    orderNumber: 'ORD-2026-0819-KCO',
    targetDeliveryDate: '2026-08-19',
    deliveryDateFormatted: 'Wednesday, 19 Aug 2026',
    deliverySlot: '12:00 PM Sharp',
    deliveryFloor: 'Floor 3 (Reception Pantry)',
    companyLocation: 'Intellect Design Arena • 11 Alice Lane, Building 1',
    items: [
      {
        id: 'ci_past_01',
        menuItem: MENU_ITEMS[2],
        quantity: 1,
        size: 'standard',
        targetDeliveryDate: '2026-08-19',
        unitPrice: 80.0,
        totalPrice: 80.0,
      },
    ],
    itemSubtotal: 80.0,
    deliveryFee: 0.0,
    vatAmount: 0.0,
    totalPaid: 80.0,
    paymentMethod: 'Instant EFT',
    paymentReference: 'PF-EFT-7712390',
    status: 'delivered',
    stage: 4,
    createdAt: '2026-08-17T11:00:00Z',
    itnVerifiedAt: '2026-08-17T11:00:15Z',
    taxInvoiceNumber: 'INV-KC-2608-0819',
    rating: {
      rating: 5,
      feedback: 'Excellent BBQ chicken! Delivered warm right on 12:00 PM.',
      submittedAt: '2026-08-19T12:45:00Z',
    },
  },
];
