// DISABLED: no screen opens this file. Remove the "// " prefixes to restore it.
export {};

// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   TextInput,
//   Modal,
//   StyleSheet,
//   Alert,
//   Platform,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { BlurView } from 'expo-blur';
// import { useTheme } from '../../theme/ThemeContext';
// import { useCart } from '../../context/CartContext';
// import { MenuItem, MenuCategory, DietaryTag, MenuType } from '../../types';
//
// const DIETARY_OPTIONS: DietaryTag[] = [
//   'Halaal',
//   'Vegetarian',
//   'Vegan',
//   'Gluten-Free',
//   'Dairy-Free',
//   'Low Carb',
//   'Nut-Free',
// ];
//
// export const MenuManagementTab: React.FC = () => {
//   const { theme, isDark } = useTheme();
//   const {
//     menuItems,
//     categories,
//     addMenuItem,
//     updateMenuItem,
//     archiveMenuItem,
//     addCategory,
//     updateCategory,
//   } = useCart();
//
//   // Modals state
//   const [isAddDishOpen, setIsAddDishOpen] = useState<boolean>(false);
//   const [isEditDishOpen, setIsEditDishOpen] = useState<boolean>(false);
//   const [isAddCategoryOpen, setIsAddCategoryOpen] = useState<boolean>(false);
//   const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
//
//   // Form states for New / Edit Dish
//   const [formName, setFormName] = useState<string>('');
//   const [formDescription, setFormDescription] = useState<string>('');
//   const [formIngredients, setFormIngredients] = useState<string>('');
//   const [formPrice, setFormPrice] = useState<string>('');
//   const [formCategoryId, setFormCategoryId] = useState<string>(categories[0]?.id || 'cat_mains');
//   const [formMenuType, setFormMenuType] = useState<MenuType>('standard');
//   const [formDietaryTags, setFormDietaryTags] = useState<DietaryTag[]>([]);
//
//   // Category form
//   const [newCatName, setNewCatName] = useState<string>('');
//   const [newCatImage, setNewCatImage] = useState<string>('https://images.unsplash.com/photo-1544025162-d76694265947?w=1200');
//
//   const openAddModal = () => {
//     setFormName('');
//     setFormDescription('');
//     setFormIngredients('');
//     setFormPrice('95.00');
//     setFormCategoryId(categories[0]?.id || 'cat_mains');
//     setFormMenuType('standard');
//     setFormDietaryTags(['Halaal']);
//     setIsAddDishOpen(true);
//   };
//
//   const openEditModal = (dish: MenuItem) => {
//     setEditingDish(dish);
//     setFormName(dish.name);
//     setFormDescription(dish.description);
//     setFormIngredients(dish.ingredients);
//     setFormPrice(dish.price.toString());
//     setFormCategoryId(dish.categoryId);
//     setFormMenuType(dish.menuType);
//     setFormDietaryTags([...dish.dietaryTags]);
//     setIsEditDishOpen(true);
//   };
//
//   const toggleDietaryTag = (tag: DietaryTag) => {
//     if (formDietaryTags.includes(tag)) {
//       setFormDietaryTags(formDietaryTags.filter((t) => t !== tag));
//     } else {
//       setFormDietaryTags([...formDietaryTags, tag]);
//     }
//   };
//
//   const handleSaveNewDish = async () => {
//     if (!formName.trim() || !formPrice) {
//       Alert.alert('Missing Fields', 'Please provide a dish name and price.');
//       return;
//     }
//
//     const priceNum = parseFloat(formPrice);
//     if (isNaN(priceNum) || priceNum <= 0) {
//       Alert.alert('Invalid Price', 'Please enter a valid price in ZAR.');
//       return;
//     }
//
//     await addMenuItem({
//       name: formName.trim(),
//       description: formDescription.trim() || 'Chef special corporate lunch portion.',
//       ingredients: formIngredients.trim() || 'Standardized fresh ingredients.',
//       price: priceNum,
//       categoryId: formCategoryId,
//       menuType: formMenuType,
//       dietaryTags: formDietaryTags,
//       isAvailable: true,
//     });
//
//     setIsAddDishOpen(false);
//     Alert.alert('Dish Published', `${formName} has been published to the active corporate menu.`);
//   };
//
//   const handleSaveEditDish = async () => {
//     if (!editingDish) return;
//     const priceNum = parseFloat(formPrice);
//
//     await updateMenuItem(editingDish.id, {
//       name: formName.trim(),
//       description: formDescription.trim(),
//       ingredients: formIngredients.trim(),
//       price: isNaN(priceNum) ? editingDish.price : priceNum,
//       categoryId: formCategoryId,
//       menuType: formMenuType,
//       dietaryTags: formDietaryTags,
//     });
//
//     setIsEditDishOpen(false);
//     setEditingDish(null);
//     Alert.alert('Dish Updated', 'Menu item changes saved successfully.');
//   };
//
//   const handleArchiveDish = (dish: MenuItem) => {
//     Alert.alert(
//       'Soft-Delete & Archive Dish',
//       `Are you sure you want to archive '${dish.name}'?\n\nStrict Rule: The dish will be hidden from user advance ordering, but preserved for historical tax invoices and financial auditing.`,
//       [
//         { text: 'Cancel', style: 'cancel' },
//         {
//           text: 'Archive Dish',
//           style: 'destructive',
//           onPress: async () => {
//             await archiveMenuItem(dish.id);
//           },
//         },
//       ]
//     );
//   };
//
//   const handleSaveCategory = async () => {
//     if (!newCatName.trim()) {
//       Alert.alert('Missing Name', 'Please enter a category title.');
//       return;
//     }
//
//     await addCategory({
//       name: newCatName.trim(),
//       slug: newCatName.toLowerCase().replace(/\s+/g, '-'),
//       heroImage: newCatImage.trim(),
//       menuType: 'standard',
//       displayOrder: categories.length + 1,
//       isActive: true,
//     });
//
//     setNewCatName('');
//     setIsAddCategoryOpen(false);
//     Alert.alert('Category Added', 'New category created successfully.');
//   };
//
//   const [searchQuery, setSearchQuery] = useState<string>('');
//
//   const filteredDishes = menuItems.filter((dish) => {
//     if (!searchQuery.trim()) return true;
//     const q = searchQuery.toLowerCase().trim();
//     const cat = categories.find((c) => c.id === dish.categoryId);
//     return (
//       dish.name.toLowerCase().includes(q) ||
//       dish.description.toLowerCase().includes(q) ||
//       dish.ingredients.toLowerCase().includes(q) ||
//       (cat?.name && cat.name.toLowerCase().includes(q)) ||
//       dish.dietaryTags.some((t) => t.toLowerCase().includes(q))
//     );
//   });
//
//   return (
//     <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
//       {/* 1. Category Management Toolbar */}
//       <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <View style={styles.cardHeaderRow}>
//           <View>
//             <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Menu Categories ({categories.length})</Text>
//             <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Organize dishes & section headings</Text>
//           </View>
//           <TouchableOpacity
//             activeOpacity={0.8}
//             onPress={() => setIsAddCategoryOpen(true)}
//             style={[styles.addBtn, { backgroundColor: theme.primary }]}
//           >
//             <Ionicons name="add" size={16} color="#FFFFFF" />
//             <Text style={styles.addBtnText}>+ Category</Text>
//           </TouchableOpacity>
//         </View>
//
//         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catsRow}>
//           {categories.map((cat) => (
//             <View
//               key={cat.id}
//               style={[styles.catBadge, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorderLight }]}
//             >
//               <Text style={[styles.catBadgeText, { color: theme.textPrimary }]}>{cat.name}</Text>
//             </View>
//           ))}
//         </ScrollView>
//       </View>
//
//       {/* Search Input Bar */}
//       <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <Ionicons name="search" size={18} color={theme.textSecondary} />
//         <TextInput
//           style={[styles.searchInput, { color: theme.textPrimary }]}
//           placeholder="Search dishes by name, category, ingredient, or tag..."
//           placeholderTextColor={theme.textMuted}
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//         {searchQuery.trim().length > 0 && (
//           <TouchableOpacity onPress={() => setSearchQuery('')}>
//             <Ionicons name="close-circle" size={18} color={theme.textMuted} />
//           </TouchableOpacity>
//         )}
//       </View>
//
//       {/* 2. Dish CRUD Table & Action Toolbar */}
//       <View style={styles.sectionHeaderRow}>
//         <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
//           DISH CATALOG & REPRICING ({filteredDishes.length})
//         </Text>
//         <TouchableOpacity
//           activeOpacity={0.85}
//           onPress={openAddModal}
//           style={[styles.addDishBtn, { backgroundColor: theme.primary }]}
//         >
//           <Ionicons name="add" size={16} color="#FFFFFF" />
//           <Text style={styles.addDishBtnText}>+ Add New Dish</Text>
//         </TouchableOpacity>
//       </View>
//
//       {/* Dishes List */}
//       <View style={styles.dishesList}>
//         {filteredDishes.map((dish) => {
//           const category = categories.find((c) => c.id === dish.categoryId);
//
//           return (
//             <View
//               key={dish.id}
//               style={[
//                 styles.dishCard,
//                 { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
//                 !dish.isAvailable && { opacity: 0.6, backgroundColor: theme.surfaceHighlight },
//               ]}
//             >
//               <View style={styles.dishTopRow}>
//                 <View style={styles.dishInfoCol}>
//                   <View style={styles.dishTitleRow}>
//                     <Text style={[styles.dishName, { color: theme.textPrimary }]}>{dish.name}</Text>
//                     <TouchableOpacity
//                       activeOpacity={0.7}
//                       onPress={async () => {
//                         await updateMenuItem(dish.id, { isAvailable: !dish.isAvailable });
//                       }}
//                       style={[
//                         styles.statusToggleBtn,
//                         dish.isAvailable
//                           ? { backgroundColor: theme.successSurface, borderColor: theme.success }
//                           : { backgroundColor: theme.surfaceBorder, borderColor: theme.textMuted },
//                       ]}
//                     >
//                       <Ionicons
//                         name={dish.isAvailable ? 'checkmark-circle' : 'close-circle'}
//                         size={12}
//                         color={dish.isAvailable ? theme.success : theme.textMuted}
//                       />
//                       <Text
//                         style={[
//                           styles.statusTagText,
//                           { color: dish.isAvailable ? theme.success : theme.textMuted },
//                         ]}
//                       >
//                         {dish.isAvailable ? 'Active' : 'Inactive'}
//                       </Text>
//                     </TouchableOpacity>
//                   </View>
//                   <Text style={[styles.dishCat, { color: theme.textSecondary }]}>
//                     {category?.name || 'Standard'} • {dish.menuType === 'chefs_choice' ? "Chef's Cycle" : 'Standard Classic'}
//                   </Text>
//                 </View>
//
//                 <Text style={[styles.dishPrice, { color: theme.primary }]}>
//                   R {dish.price.toFixed(2)}
//                 </Text>
//               </View>
//
//               <Text style={[styles.dishIngredients, { color: theme.textSecondary }]} numberOfLines={2}>
//                 {dish.ingredients}
//               </Text>
//
//               {/* Dietary Tags */}
//               <View style={styles.tagsRow}>
//                 {dish.dietaryTags.map((tag) => (
//                   <View
//                     key={tag}
//                     style={[styles.dietaryPill, { backgroundColor: theme.surfaceHighlight }]}
//                   >
//                     <Text style={[styles.dietaryPillText, { color: theme.textSecondary }]}>{tag}</Text>
//                   </View>
//                 ))}
//               </View>
//
//               <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />
//
//               {/* Actions */}
//               <View style={styles.actionsRow}>
//                 <TouchableOpacity
//                   activeOpacity={0.8}
//                   onPress={() => openEditModal(dish)}
//                   style={[styles.actionBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}
//                 >
//                   <Ionicons name="create-outline" size={14} color={theme.primary} />
//                   <Text style={[styles.actionBtnText, { color: theme.textPrimary }]}>Edit</Text>
//                 </TouchableOpacity>
//
//                 <TouchableOpacity
//                   activeOpacity={0.8}
//                   onPress={async () => {
//                     await updateMenuItem(dish.id, { isAvailable: !dish.isAvailable });
//                   }}
//                   style={[
//                     styles.actionBtn,
//                     {
//                       backgroundColor: dish.isAvailable ? theme.surfaceHighlight : theme.successSurface,
//                       borderColor: dish.isAvailable ? theme.surfaceBorder : theme.success,
//                     },
//                   ]}
//                 >
//                   <Ionicons
//                     name={dish.isAvailable ? 'pause-outline' : 'play-outline'}
//                     size={14}
//                     color={dish.isAvailable ? theme.textSecondary : theme.success}
//                   />
//                   <Text
//                     style={[
//                       styles.actionBtnText,
//                       { color: dish.isAvailable ? theme.textSecondary : theme.success },
//                     ]}
//                   >
//                     {dish.isAvailable ? 'Set Inactive' : 'Set Active'}
//                   </Text>
//                 </TouchableOpacity>
//
//                 <TouchableOpacity
//                   activeOpacity={0.8}
//                   onPress={() => handleArchiveDish(dish)}
//                   style={[styles.archiveBtn, { borderColor: theme.errorBorder }]}
//                 >
//                   <Ionicons name="trash-outline" size={14} color={theme.error} />
//                   <Text style={[styles.archiveBtnText, { color: theme.error }]}>Delete</Text>
//                 </TouchableOpacity>
//               </View>
//             </View>
//           );
//         })}
//       </View>
//
//       {/* Add / Edit Dish Modal */}
//       <Modal visible={isAddDishOpen || isEditDishOpen} transparent animationType="slide">
//         <View style={styles.modalOverlay}>
//           <BlurView
//             intensity={Platform.OS === 'ios' ? 60 : 95}
//             tint={isDark ? 'dark' : 'light'}
//             style={StyleSheet.absoluteFill}
//           />
//           <View
//             style={[
//               StyleSheet.absoluteFill,
//               { backgroundColor: isDark ? 'rgba(0,0,0,0.68)' : 'rgba(15,23,42,0.45)' },
//             ]}
//           />
//           <View style={[styles.modalSheet, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
//             <View style={[styles.handleBar, { backgroundColor: theme.surfaceBorderLight }]} />
//
//             <View style={styles.modalHeader}>
//               <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
//                 {isAddDishOpen ? 'Add New Corporate Meal' : 'Edit Meal Details'}
//               </Text>
//               <TouchableOpacity
//                 onPress={() => {
//                   setIsAddDishOpen(false);
//                   setIsEditDishOpen(false);
//                 }}
//                 style={[styles.closeModalBtn, { backgroundColor: theme.surface }]}
//               >
//                 <Ionicons name="close" size={20} color={theme.textSecondary} />
//               </TouchableOpacity>
//             </View>
//
//             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
//               {/* Menu Type Radio */}
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Target Menu</Text>
//               <View style={styles.radioRow}>
//                 <TouchableOpacity
//                   onPress={() => setFormMenuType('standard')}
//                   style={[
//                     styles.radioBtn,
//                     { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
//                     formMenuType === 'standard' && { borderColor: theme.primary, backgroundColor: theme.primaryMuted },
//                   ]}
//                 >
//                   <Text style={[styles.radioText, { color: formMenuType === 'standard' ? theme.primary : theme.textSecondary }]}>
//                     Standard Menu
//                   </Text>
//                 </TouchableOpacity>
//
//                 <TouchableOpacity
//                   onPress={() => setFormMenuType('chefs_choice')}
//                   style={[
//                     styles.radioBtn,
//                     { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
//                     formMenuType === 'chefs_choice' && { borderColor: theme.primary, backgroundColor: theme.primaryMuted },
//                   ]}
//                 >
//                   <Text style={[styles.radioText, { color: formMenuType === 'chefs_choice' ? theme.primary : theme.textSecondary }]}>
//                     Chef's Choice Cycle
//                   </Text>
//                 </TouchableOpacity>
//               </View>
//
//               {/* Title */}
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Dish Title</Text>
//               <TextInput
//                 style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
//                 placeholder="e.g. Cape Malay Chicken Curry"
//                 placeholderTextColor={theme.textMuted}
//                 value={formName}
//                 onChangeText={setFormName}
//               />
//
//               {/* Price in ZAR */}
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Price (ZAR)</Text>
//               <TextInput
//                 style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
//                 placeholder="e.g. 95.00"
//                 placeholderTextColor={theme.textMuted}
//                 keyboardType="numeric"
//                 value={formPrice}
//                 onChangeText={setFormPrice}
//               />
//
//               {/* Ingredients */}
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Ingredients List</Text>
//               <TextInput
//                 style={[styles.modalInputTextarea, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
//                 placeholder="e.g. Free-range chicken, turmeric, coconut cream, basmati rice..."
//                 placeholderTextColor={theme.textMuted}
//                 multiline
//                 numberOfLines={2}
//                 value={formIngredients}
//                 onChangeText={setFormIngredients}
//                 textAlignVertical="top"
//               />
//
//               {/* Description */}
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Culinary Description</Text>
//               <TextInput
//                 style={[styles.modalInputTextarea, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
//                 placeholder="Short mouth-watering description..."
//                 placeholderTextColor={theme.textMuted}
//                 multiline
//                 numberOfLines={2}
//                 value={formDescription}
//                 onChangeText={setFormDescription}
//                 textAlignVertical="top"
//               />
//
//               {/* Dietary Checkboxes */}
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Dietary Flags</Text>
//               <View style={styles.dietaryCheckGrid}>
//                 {DIETARY_OPTIONS.map((tag) => {
//                   const isChecked = formDietaryTags.includes(tag);
//                   return (
//                     <TouchableOpacity
//                       key={tag}
//                       onPress={() => toggleDietaryTag(tag)}
//                       style={[
//                         styles.checkPill,
//                         { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
//                         isChecked && { backgroundColor: theme.primary, borderColor: theme.primary },
//                       ]}
//                     >
//                       <Ionicons
//                         name={isChecked ? 'checkmark' : 'add'}
//                         size={14}
//                         color={isChecked ? '#FFFFFF' : theme.textSecondary}
//                       />
//                       <Text
//                         style={[
//                           styles.checkPillText,
//                           { color: isChecked ? '#FFFFFF' : theme.textSecondary },
//                         ]}
//                       >
//                         {tag}
//                       </Text>
//                     </TouchableOpacity>
//                   );
//                 })}
//               </View>
//
//               {/* Save CTA */}
//               <TouchableOpacity
//                 activeOpacity={0.85}
//                 onPress={isAddDishOpen ? handleSaveNewDish : handleSaveEditDish}
//                 style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}
//               >
//                 <Text style={styles.modalSaveBtnText}>
//                   {isAddDishOpen ? 'Publish to Menu' : 'Save Changes'}
//                 </Text>
//               </TouchableOpacity>
//             </ScrollView>
//           </View>
//         </View>
//       </Modal>
//
//       {/* Add Category Modal */}
//       <Modal visible={isAddCategoryOpen} transparent animationType="slide">
//         <View style={styles.modalOverlay}>
//           <BlurView
//             intensity={Platform.OS === 'ios' ? 60 : 95}
//             tint={isDark ? 'dark' : 'light'}
//             style={StyleSheet.absoluteFill}
//           />
//           <View
//             style={[
//               StyleSheet.absoluteFill,
//               { backgroundColor: isDark ? 'rgba(0,0,0,0.68)' : 'rgba(15,23,42,0.45)' },
//             ]}
//           />
//           <View style={[styles.modalSheet, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight, maxHeight: '60%' }]}>
//             <View style={[styles.handleBar, { backgroundColor: theme.surfaceBorderLight }]} />
//             <Text style={[styles.modalTitle, { color: theme.textPrimary, marginBottom: 14 }]}>
//               + Add Menu Category
//             </Text>
//
//             <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Category Name</Text>
//             <TextInput
//               style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary, marginBottom: 14 }]}
//               placeholder="e.g. Gourmet Sandwiches & Wraps"
//               placeholderTextColor={theme.textMuted}
//               value={newCatName}
//               onChangeText={setNewCatName}
//             />
//
//             <TouchableOpacity
//               activeOpacity={0.85}
//               onPress={handleSaveCategory}
//               style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}
//             >
//               <Text style={styles.modalSaveBtnText}>Create Category</Text>
//             </TouchableOpacity>
//
//             <TouchableOpacity
//               onPress={() => setIsAddCategoryOpen(false)}
//               style={styles.cancelLink}
//             >
//               <Text style={[styles.cancelLinkText, { color: theme.textSecondary }]}>Cancel</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//
//       <View style={styles.footerSpacing} />
//     </ScrollView>
//   );
// };
//
// const styles = StyleSheet.create({
//   scroll: {
//     padding: 16,
//     paddingBottom: 40,
//     gap: 14,
//   },
//   card: {
//     borderRadius: 18,
//     padding: 16,
//     borderWidth: 1,
//     gap: 12,
//   },
//   cardHeaderRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   cardTitle: {
//     fontSize: 16,
//     fontWeight: '800',
//   },
//   cardSub: {
//     fontSize: 12,
//     marginTop: 2,
//   },
//   addBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 8,
//   },
//   addBtnText: {
//     fontSize: 11,
//     fontWeight: '700',
//     color: '#FFFFFF',
//   },
//   catsRow: {
//     gap: 8,
//   },
//   catBadge: {
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 10,
//     borderWidth: 1,
//   },
//   catBadgeText: {
//     fontSize: 12,
//     fontWeight: '700',
//   },
//   searchBox: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderRadius: 14,
//     borderWidth: 1,
//     paddingHorizontal: 12,
//     paddingVertical: 10,
//     gap: 10,
//   },
//   searchInput: {
//     flex: 1,
//     fontSize: 13,
//     padding: 0,
//   },
//   sectionHeaderRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginHorizontal: 4,
//   },
//   sectionHeading: {
//     fontSize: 11,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },
//   addDishBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 8,
//   },
//   addDishBtnText: {
//     fontSize: 12,
//     fontWeight: '700',
//     color: '#FFFFFF',
//   },
//   dishesList: {
//     gap: 10,
//   },
//   dishCard: {
//     borderRadius: 16,
//     padding: 14,
//     borderWidth: 1,
//     gap: 8,
//   },
//   dishTopRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//   },
//   dishInfoCol: {
//     flex: 1,
//     paddingRight: 8,
//   },
//   dishTitleRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     flexWrap: 'wrap',
//   },
//   dishName: {
//     fontSize: 14,
//     fontWeight: '800',
//   },
//   statusTag: {
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 4,
//   },
//   statusToggleBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderRadius: 6,
//     borderWidth: 1,
//   },
//   statusTagText: {
//     fontSize: 9,
//     fontWeight: '700',
//   },
//   dishCat: {
//     fontSize: 11,
//     marginTop: 2,
//   },
//   dishPrice: {
//     fontSize: 15,
//     fontWeight: '800',
//   },
//   dishIngredients: {
//     fontSize: 12,
//     lineHeight: 16,
//   },
//   tagsRow: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 6,
//   },
//   dietaryPill: {
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 4,
//   },
//   dietaryPillText: {
//     fontSize: 10,
//     fontWeight: '600',
//   },
//   divider: {
//     height: 1,
//     marginVertical: 2,
//   },
//   actionsRow: {
//     flexDirection: 'row',
//     gap: 8,
//   },
//   actionBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 8,
//     borderWidth: 1,
//   },
//   actionBtnText: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   archiveBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 8,
//     borderWidth: 1,
//   },
//   archiveBtnText: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   restoreBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 8,
//   },
//   restoreBtnText: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   modalOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.7)',
//     justifyContent: 'flex-end',
//   },
//   modalSheet: {
//     borderTopLeftRadius: 26,
//     borderTopRightRadius: 26,
//     paddingHorizontal: 20,
//     paddingTop: 12,
//     paddingBottom: Platform.OS === 'ios' ? 36 : 24,
//     maxHeight: '90%',
//     borderTopWidth: 1,
//   },
//   handleBar: {
//     width: 44,
//     height: 4,
//     borderRadius: 2,
//     alignSelf: 'center',
//     marginBottom: 14,
//   },
//   modalHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 14,
//   },
//   modalTitle: {
//     fontSize: 18,
//     fontWeight: '800',
//   },
//   closeModalBtn: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   modalScroll: {
//     paddingBottom: 20,
//     gap: 8,
//   },
//   inputLabel: {
//     fontSize: 12,
//     fontWeight: '700',
//     marginTop: 4,
//   },
//   radioRow: {
//     flexDirection: 'row',
//     gap: 8,
//   },
//   radioBtn: {
//     flex: 1,
//     paddingVertical: 10,
//     alignItems: 'center',
//     borderRadius: 10,
//     borderWidth: 1.5,
//   },
//   radioText: {
//     fontSize: 12,
//     fontWeight: '700',
//   },
//   modalInput: {
//     borderWidth: 1,
//     borderRadius: 10,
//     paddingHorizontal: 12,
//     height: 44,
//     fontSize: 13,
//   },
//   modalInputTextarea: {
//     borderWidth: 1,
//     borderRadius: 10,
//     padding: 10,
//     fontSize: 13,
//     minHeight: 54,
//   },
//   dietaryCheckGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 6,
//   },
//   checkPill: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 8,
//     borderWidth: 1,
//   },
//   checkPillText: {
//     fontSize: 11,
//     fontWeight: '600',
//   },
//   modalSaveBtn: {
//     borderRadius: 12,
//     paddingVertical: 14,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginTop: 10,
//   },
//   modalSaveBtnText: {
//     fontSize: 14,
//     fontWeight: '800',
//     color: '#FFFFFF',
//   },
//   cancelLink: {
//     alignItems: 'center',
//     paddingVertical: 10,
//   },
//   cancelLinkText: {
//     fontSize: 13,
//     fontWeight: '600',
//   },
//   footerSpacing: {
//     height: 40,
//   },
// });
//
