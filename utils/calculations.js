/**
 * Smart Car Wash Pro 2.0 - Calculation Utilities
 * Implements pricing and time calculation algorithms
 */

/**
 * Calculate service duration based on requirements
 * @param {number} dirtLevel - Dirt level from 1-5
 * @param {string} serviceType - Type of service (exterior, interior, polish, wax)
 * @returns {number} Duration in minutes
 */
const calculateDuration = (dirtLevel, serviceType) => {
  // Base time: 30 minutes
  let duration = 30;
  
  // Add time based on dirt level: 10 minutes × dirt level
  duration += 10 * dirtLevel;
  
  // Add extra time for additional services (as per requirements)
  if (serviceType.includes('polish')) {
    duration += 15; // +15 minutes for polishing
  }
  if (serviceType.includes('wax')) {
    duration += 10; // +10 minutes for waxing
  }
  
  return duration;
};

/**
 * Calculate service price based on requirements
 * @param {number} dirtLevel - Dirt level from 1-5
 * @param {number} distanceKm - Distance from mobile unit in kilometers
 * @param {string} serviceType - Type of service
 * @returns {number} Price in NIS
 */
const calculatePrice = (dirtLevel, distanceKm, serviceType) => {
  // Base price: 50 NIS
  let price = 50;
  
  // Add price based on dirt level: 20 NIS × dirt level
  price += 20 * dirtLevel;
  
  // Add distance cost: 2 NIS × kilometers
  price += 2 * distanceKm;
  
  // Note: According to requirements, only base + dirt level + distance
  // Service types (exterior, interior, polish, wax) don't add extra cost
  // They only affect duration, not price
  
  return Math.round(price);
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - First latitude
 * @param {number} lng1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lng2 - Second longitude
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Find the best available mobile unit
 * @param {Array} mobiles - Array of mobile units
 * @param {number} customerLat - Customer latitude
 * @param {number} customerLng - Customer longitude
 * @returns {Object} Best mobile unit with distance
 */
const findBestMobile = (mobiles, customerLat, customerLng, activeOrders) => {
  const now = new Date();
  const trulyAvailableMobiles = mobiles.filter(mobile => 
    mobile.is_available === 1 && new Date(mobile.available_from) <= now
  );
  // Filter available mobiles
  if (trulyAvailableMobiles.length > 0) {
    // === תרחיש א': יש ניידות פנויות. בחר את הקרובה ביותר ===
    console.log('[Assigner] Scenario A: At least one unit is available now. Finding the closest one.');
    
    let closestMobile = null;
    let minDistance = Infinity;

    trulyAvailableMobiles.forEach(mobile => {
      const distance = calculateDistance(
        mobile.location_lat,
        mobile.location_lng,
        customerLat,
        customerLng
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestMobile = mobile;
      }
    });

    if (closestMobile) {
      closestMobile.distance = parseFloat(minDistance.toFixed(2));
    }
    return closestMobile;

  } else {
    // === תרחיש ב': כל הניידות תפוסות. בחר את זו שמתפנה הכי מוקדם ===
    console.log('[Assigner] Scenario B: All units are busy. Finding the one that will be available soonest.');
    
    const mobilesWithFutureData = mobiles.map(mobile => {
      // מצא את ההזמנה האחרונה המשויכת לניידת זו (היא מגדירה את המיקום העתידי שלה)
      const lastOrderForMobile = activeOrders
        .filter(o => o.mobile_id === mobile.id)
        .sort((a, b) => new Date(b.requested_datetime) - new Date(a.requested_datetime))[0];
      
      // המיקום שממנו נחשב את המרחק הוא המיקום של ההזמנה האחרונה, או המיקום הנוכחי אם אין לה הזמנות עתידיות
      const startLat = lastOrderForMobile ? lastOrderForMobile.location_lat : mobile.location_lat;
      const startLng = lastOrderForMobile ? lastOrderForMobile.location_lng : mobile.location_lng;

      const distance = calculateDistance(startLat, startLng, customerLat, customerLng);
      
      return {
        ...mobile,
        distance: parseFloat(distance.toFixed(2)),
        // הזמן שהניידת תתפנה מהתור הקיים שלה
        effective_available_from: new Date(mobile.available_from).getTime()
      };
    });

    // מיין לפי הזמן שהניידת מתפנה. הניידת הטובה ביותר היא הראשונה ברשימה.
    mobilesWithFutureData.sort((a, b) => a.effective_available_from - b.effective_available_from);

    return mobilesWithFutureData[0];
  }
};

/**
 * Generate order summary for confirmation
 * @param {Object} orderData - Order data
 * @param {Object} mobileData - Selected mobile data
 * @returns {Object} Order summary
 */
const generateOrderSummary = (orderData, mobileData) => {
  const duration = calculateDuration(orderData.dirt_level, orderData.service_type);
  const price = calculatePrice(orderData.dirt_level, mobileData.distance, orderData.service_type);
  
  return {
    orderId: null, // Will be set when saved to database
    vehicleNumber: orderData.vehicle_number,
    vehicleType: orderData.vehicle_type,
    serviceType: orderData.service_type,
    requestedDateTime: orderData.requested_datetime,
    location: {
      lat: orderData.location_lat,
      lng: orderData.location_lng,
      address: orderData.location_address
    },
    dirtLevel: orderData.dirt_level,
    duration: duration,
    price: price,
    mobile: {
      id: mobileData.id,
      name: mobileData.name,
      distance: mobileData.distance,
      estimatedArrival: mobileData.estimatedArrival
    },
    status: 'pending'
  };
};

module.exports = {
  calculateDuration,
  calculatePrice,
  calculateDistance,
  findBestMobile,
  generateOrderSummary
};
