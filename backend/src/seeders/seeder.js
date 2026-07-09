const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' }); // load from backend folder
const Admin = require('../models/Admin');
const Service = require('../models/Service');
const User = require('../models/User');

const seedData = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vmarc';
        console.log(`Connecting to database at ${uri}...`);
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB for seeding');

        // 1) Seed Admin User
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@vmarc.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

        const existingAdmin = await Admin.findOne({ email: adminEmail });
        if (!existingAdmin) {
            await Admin.create({
                name: 'vmarc Administrator',
                email: adminEmail,
                password: adminPassword,
                permissions: ['all']
            });
            console.log(`✅ Default admin account created: ${adminEmail}`);
        } else {
            console.log(`ℹ️ Admin account already exists: ${adminEmail}`);
        }

        // Also create an admin user entry in User collection
        const existingUserAdmin = await User.findOne({ email: adminEmail });
        if (!existingUserAdmin) {
            await User.create({
                name: 'vmarc Administrator',
                email: adminEmail,
                password: adminPassword,
                phone: '+10000000000',
                role: 'admin',
                isPhoneVerified: true
            });
            console.log(`✅ Default User admin account created: ${adminEmail}`);
        }

        // 2) Seed Comprehensive Services with Categories and Subcategories
        const sampleServices = [
            // ============= HOME CARE SERVICES =============
            // Cleaning Category
            {
                name: 'Home Care',
                description: 'Deep bedroom cleaning including dusting, floor cleaning, bed-side area cleaning, visible stain removal, and surface sanitization.',
                price: 699,
                duration: 60,
                category: 'Cleaning',
                subcategory: 'Bedroom Cleaning',
                imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 120
            },
            {
                name: 'Home Care',
                description: 'Toilet and bathroom cleaning with descaling, floor scrubbing, fixture cleaning, and odor-control sanitization.',
                price: 599,
                duration: 45,
                category: 'Cleaning',
                subcategory: 'Toilet Cleaning',
                imageUrl: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.6,
                ratingsQuantity: 95
            },
            {
                name: 'Home Care',
                description: 'Kitchen cleaning including countertop cleaning, sink cleaning, oil stain treatment, cabinet exterior cleaning, and floor cleaning.',
                price: 799,
                duration: 75,
                category: 'Cleaning',
                subcategory: 'Kitchen Cleaning',
                imageUrl: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 200
            },
            {
                name: 'Home Care',
                description: 'Professional sofa vacuuming and shampoo cleaning for dust, light stains, and fabric freshness.',
                price: 899,
                duration: 45,
                category: 'Cleaning',
                subcategory: 'Sofa Cleaning',
                imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 85
            },
            {
                name: 'Home Care',
                description: 'Thorough carpet cleaning with steam extraction, stain removal, and deodorizing.',
                price: 999,
                duration: 60,
                category: 'Cleaning',
                subcategory: 'Carpet Cleaning',
                imageUrl: 'https://images.unsplash.com/photo-1585746440710-2d829a08b2bb?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.5,
                ratingsQuantity: 70
            },
            {
                name: 'Home Care',
                description: 'Full home deep cleaning including all rooms, kitchen, bathrooms, and living areas.',
                price: 2499,
                duration: 180,
                category: 'Cleaning',
                subcategory: 'Full Home Deep Cleaning',
                imageUrl: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 300
            },

            // Plumbing Category
            {
                name: 'Home Care',
                description: 'Quick fix for leaking pipes, dripping taps, and minor pipe repairs.',
                price: 499,
                duration: 45,
                category: 'Plumbing',
                subcategory: 'Pipe Leak Repair',
                imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.6,
                ratingsQuantity: 110
            },
            {
                name: 'Home Care',
                description: 'Complete faucet installation or replacement with professional fitting.',
                price: 699,
                duration: 60,
                category: 'Plumbing',
                subcategory: 'Tap Installation',
                imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.4,
                ratingsQuantity: 55
            },
            {
                name: 'Home Care',
                description: 'Full bathroom plumbing setup including pipes, fittings, and sanitaryware.',
                price: 1499,
                duration: 180,
                category: 'Plumbing',
                subcategory: 'Bathroom Plumbing',
                imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 90
            },
            {
                name: 'Home Care',
                description: 'Professional water heater installation with proper connections and testing.',
                price: 899,
                duration: 90,
                category: 'Plumbing',
                subcategory: 'Water Heater Installation',
                imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 130
            },

            // Electrical Category
            {
                name: 'Home Care',
                description: 'Fan, switchboard, and minor wiring repair for common household electrical issues.',
                price: 499,
                duration: 60,
                category: 'Electrical',
                subcategory: 'Minor Electrical Repair',
                imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.5,
                ratingsQuantity: 100
            },
            {
                name: 'Home Care',
                description: 'Professional light fixture installation including chandeliers, LED panels, and pendant lights.',
                price: 799,
                duration: 90,
                category: 'Electrical',
                subcategory: 'Light Installation',
                imageUrl: 'https://images.unsplash.com/photo-1562408590-e32931084e23?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 80
            },
            {
                name: 'Home Care',
                description: 'Complete home wiring inspection with safety check and minor upgrades.',
                price: 1199,
                duration: 120,
                category: 'Electrical',
                subcategory: 'Home Wiring Inspection',
                imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 150
            },
            {
                name: 'Home Care',
                description: 'Switchboard upgrade with new switches, sockets, and circuit breakers.',
                price: 999,
                duration: 90,
                category: 'Electrical',
                subcategory: 'Switchboard Upgrade',
                imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.6,
                ratingsQuantity: 65
            },

            // Handyman Category
            {
                name: 'Home Care',
                description: 'Quick furniture assembly service for all types of furniture.',
                price: 699,
                duration: 60,
                category: 'Handyman',
                subcategory: 'Furniture Assembly',
                imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 95
            },
            {
                name: 'Home Care',
                description: 'Door lock installation, repair, and replacement service.',
                price: 799,
                duration: 45,
                category: 'Handyman',
                subcategory: 'Door Lock Repair & Installation',
                imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.4,
                ratingsQuantity: 60
            },
            {
                name: 'Home Care',
                description: 'Decorative installation services including shelves, photo frames, and wall decor.',
                price: 599,
                duration: 45,
                category: 'Handyman',
                subcategory: 'Decor Installation',
                imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 180
            },
            {
                name: 'Home Care',
                description: 'Professional wall panel installation service for modern interiors.',
                price: 1499,
                duration: 120,
                category: 'Handyman',
                subcategory: 'Wall Panel Installation',
                imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 140
            },

            // AC & Appliance Repair Category
            {
                name: 'Home Care',
                description: 'Complete AC service including filter cleaning, coil cleaning, and performance check.',
                price: 599,
                duration: 60,
                category: 'AC & Appliance',
                subcategory: 'Foam-jet AC Service',
                imageUrl: 'https://images.unsplash.com/photo-1633521754077-21abb2e12b7a?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 250
            },
            {
                name: 'Home Care',
                description: 'AC repair service for all types of AC units including split, window, and central.',
                price: 499,
                duration: 60,
                category: 'AC & Appliance',
                subcategory: 'AC Repair',
                imageUrl: 'https://images.unsplash.com/photo-1633521754077-21abb2e12b7a?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.3,
                ratingsQuantity: 200
            },
            {
                name: 'Home Care',
                description: 'Full refrigerator cleaning and maintenance service.',
                price: 899,
                duration: 75,
                category: 'AC & Appliance',
                subcategory: 'Fridge Cleaning',
                imageUrl: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.6,
                ratingsQuantity: 80
            },
            {
                name: 'Home Care',
                description: 'Washing machine check-up, cleaning, and minor repair service.',
                price: 699,
                duration: 60,
                category: 'AC & Appliance',
                subcategory: 'Washing Machine Check-up',
                imageUrl: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 110
            },
            {
                name: 'Home Care',
                description: 'Professional TV check-up and minor repair service.',
                price: 499,
                duration: 45,
                category: 'AC & Appliance',
                subcategory: 'TV Check-up',
                imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.5,
                ratingsQuantity: 75
            },
            {
                name: 'Home Care',
                description: 'RO water purifier cleaning, filter replacement, and maintenance.',
                price: 799,
                duration: 60,
                category: 'AC & Appliance',
                subcategory: 'RO Water Purifier Service',
                imageUrl: 'https://images.unsplash.com/photo-1614308452086-3c7c9fe2e914?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 160
            },

            // ============= PERSONAL CARE SERVICES =============
            // Grooming Category
            {
                name: 'Personal Care',
                description: 'Professional haircut service with hygienic tools and style consultation.',
                price: 259,
                duration: 30,
                category: 'Grooming',
                subcategory: 'Haircut for Men',
                imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 350
            },
            {
                name: 'Personal Care',
                description: 'Kids haircut service with gentle care and fun styling.',
                price: 259,
                duration: 25,
                category: 'Grooming',
                subcategory: 'Haircut for Boys',
                imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 200
            },
            {
                name: 'Personal Care',
                description: 'Relaxing head, neck, and shoulder massage to release tension.',
                price: 349,
                duration: 30,
                category: 'Grooming',
                subcategory: 'Head, Neck & Shoulder Massage',
                imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 280
            },
            {
                name: 'Personal Care',
                description: 'Roll-on waxing service for full arms, legs, and underarms.',
                price: 899,
                duration: 45,
                category: 'Beauty & Personal Care',
                subcategory: 'Roll-on Waxing',
                imageUrl: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 180
            },
            {
                name: 'Personal Care',
                description: 'Professional foot massage therapy for relaxation and pain relief.',
                price: 569,
                duration: 30,
                category: 'Beauty & Personal Care',
                subcategory: 'Foot Massage',
                imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 150
            },

            // Beauty Category
            {
                name: 'Personal Care',
                description: 'Professional makeup artist service for all occasions.',
                price: 999,
                duration: 60,
                category: 'Beauty & Personal Care',
                subcategory: 'Certified Makeup Artists',
                imageUrl: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 220
            },
            {
                name: 'Personal Care',
                description: 'Hair styling and setting service for all hair types.',
                price: 469,
                duration: 45,
                category: 'Beauty & Personal Care',
                subcategory: 'Hair Stylist',
                imageUrl: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.6,
                ratingsQuantity: 120
            },
            {
                name: 'Personal Care',
                description: 'Complete salon services including haircut, styling, and grooming.',
                price: 199,
                duration: 60,
                category: 'Beauty & Personal Care',
                subcategory: 'Salon Services',
                imageUrl: 'https://images.unsplash.com/photo-1560066984-4366529f0f6f?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 190
            },
            {
                name: 'Personal Care',
                description: 'Pampering home spa services including massage and facial.',
                price: 319,
                duration: 60,
                category: 'Beauty & Personal Care',
                subcategory: 'Home Spa Services',
                imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 260
            },
            {
                name: 'Personal Care',
                description: 'Brightening lemon deep cleanse pedicure service.',
                price: 549,
                duration: 30,
                category: 'Beauty & Personal Care',
                subcategory: 'Brightening Lemon Deep Cleanse Pedicure',
                imageUrl: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 140
            },
            {
                name: 'Personal Care',
                description: 'Brightening lemon express pedicure for quick refresh.',
                price: 649,
                duration: 25,
                category: 'Beauty & Personal Care',
                subcategory: 'Brightening Lemon Express Pedicure',
                imageUrl: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.5,
                ratingsQuantity: 100
            },

            // ============= IT & TECHNOLOGY SERVICES =============
            {
                name: 'IT & Technology',
                description: 'Professional laptop repair service including hardware and software issues.',
                price: 699,
                duration: 60,
                category: 'IT Support',
                subcategory: 'Laptop Repair',
                imageUrl: 'https://images.unsplash.com/photo-1537884944318-390069bb8665?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 210
            },
            {
                name: 'IT & Technology',
                description: 'Smart home setup including IoT devices, smart locks, and security systems.',
                price: 899,
                duration: 90,
                category: 'IT Support',
                subcategory: 'Smart Locks SetUp',
                imageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 90
            },
            {
                name: 'IT & Technology',
                description: 'Professional web design and UI/UX development for your brand.',
                price: 12000,
                duration: 480,
                category: 'Web Design',
                subcategory: 'Website Design & Development',
                imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 300
            },
            {
                name: 'IT & Technology',
                description: 'Custom software and mobile app development services.',
                price: 25000,
                duration: 720,
                category: 'Software Development',
                subcategory: 'Custom Software & App Development',
                imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 280
            },
            {
                name: 'IT & Technology',
                description: '24/7 IT support and technical assistance for businesses.',
                price: 1500,
                duration: 60,
                category: 'IT Support',
                subcategory: 'IT Support Services',
                imageUrl: 'https://images.unsplash.com/photo-1537432376769-00f5c2f4c8d2?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.6,
                ratingsQuantity: 160
            },
            {
                name: 'IT & Technology',
                description: 'Professional projector repair and maintenance service.',
                price: 1098,
                duration: 60,
                category: 'IT Support',
                subcategory: 'Projector Repairing',
                imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.4,
                ratingsQuantity: 50
            },

            // ============= BUSINESS SERVICES =============
            {
                name: 'Business Services',
                description: 'Strategic business consulting for growth and operational efficiency.',
                price: 5000,
                duration: 120,
                category: 'Consulting',
                subcategory: 'Business Consulting',
                imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 120
            },
            {
                name: 'Business Services',
                description: 'Professional digital marketing and SEO services.',
                price: 8000,
                duration: 240,
                category: 'Marketing',
                subcategory: 'Digital Marketing',
                imageUrl: 'https://images.unsplash.com/photo-1432888622747-4eb9a8f2c293?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 180
            },
            {
                name: 'Business Services',
                description: 'Social media marketing and content creation for brands.',
                price: 20000,
                duration: 360,
                category: 'Marketing',
                subcategory: 'Social Media Marketing',
                imageUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 250
            },
            {
                name: 'Business Services',
                description: 'Professional branding services including logo, identity, and strategy.',
                price: 12000,
                duration: 240,
                category: 'Marketing',
                subcategory: 'Branding',
                imageUrl: 'https://images.unsplash.com/photo-1432888622747-4eb9a8f2c293?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 200
            },
            {
                name: 'Business Services',
                description: 'Personal virtual assistant services for professionals.',
                price: 2500,
                duration: 120,
                category: 'Consulting',
                subcategory: 'Personal Virtual Assistant',
                imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.6,
                ratingsQuantity: 80
            },
            {
                name: 'Business Services',
                description: 'Professional recruitment and talent acquisition services.',
                price: 5000,
                duration: 180,
                category: 'Consulting',
                subcategory: 'Recruitment Services',
                imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 100
            },

            // ============= TRANSPORTATION SERVICES =============
            {
                name: 'Transportation',
                description: 'Book a ride or order a cab for your commute.',
                price: 259,
                duration: 30,
                category: 'Ride Services',
                subcategory: 'Book a Ride, Order a Cab',
                imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.5,
                ratingsQuantity: 500
            },
            {
                name: 'Transportation',
                description: 'Professional relocation and moving services.',
                price: 259,
                duration: 120,
                category: 'Ride Services',
                subcategory: 'Relocation Services',
                imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.6,
                ratingsQuantity: 80
            },
            {
                name: 'Transportation',
                description: 'Professional chauffeur service for your travel needs.',
                price: 349,
                duration: 60,
                category: 'Ride Services',
                subcategory: 'Book a Chauffeur',
                imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 150
            },
            {
                name: 'Transportation',
                description: 'Fast delivery services for packages up to 20kg.',
                price: 549,
                duration: 45,
                category: 'Ride Services',
                subcategory: 'Delivery Services (Upto 20kg)',
                imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.4,
                ratingsQuantity: 300
            },
            {
                name: 'Transportation',
                description: 'Large item delivery services for items up to 50kg.',
                price: 649,
                duration: 60,
                category: 'Ride Services',
                subcategory: 'Delivery Services for large items (Upto 50kg)',
                imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.5,
                ratingsQuantity: 200
            },

            // ============= PROFESSIONAL SERVICES =============
            {
                name: 'Professional Services',
                description: 'Private tutoring for all subjects and levels.',
                price: 500,
                duration: 60,
                category: 'Education',
                subcategory: 'Tutoring',
                imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 180
            },
            {
                name: 'Professional Services',
                description: 'Professional music lessons for all instruments and levels.',
                price: 800,
                duration: 60,
                category: 'Education',
                subcategory: 'Music Lessons',
                imageUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 120
            },
            {
                name: 'Professional Services',
                description: 'Professional photography services for events, portraits, and products.',
                price: 2000,
                duration: 120,
                category: 'Events & Media',
                subcategory: 'Photography',
                imageUrl: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.9,
                ratingsQuantity: 200
            },
            {
                name: 'Professional Services',
                description: 'Professional legal consultation and document review services.',
                price: 1500,
                duration: 60,
                category: 'Legal Services',
                subcategory: 'Legal Services',
                imageUrl: 'https://images.unsplash.com/photo-1589829545456-14962992b6a7?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.7,
                ratingsQuantity: 90
            },
            {
                name: 'Professional Services',
                description: 'Professional event planning and management services.',
                price: 5000,
                duration: 240,
                category: 'Events & Media',
                subcategory: 'Event Planning',
                imageUrl: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.8,
                ratingsQuantity: 140
            },
            {
                name: 'Professional Services',
                description: 'Professional translation services for multiple languages.',
                price: 800,
                duration: 60,
                category: 'Consulting',
                subcategory: 'Translation',
                imageUrl: 'https://images.unsplash.com/photo-1456406644174-8ddd4cd52a06?auto=format&fit=crop&q=80&w=400',
                isActive: true,
                ratingsAverage: 4.6,
                ratingsQuantity: 70
            }
        ];

        // Clear existing services and insert new ones
        await Service.deleteMany({});
        await Service.insertMany(sampleServices);
        console.log(`✅ ${sampleServices.length} services seeded successfully!`);
        console.log(`   - ${sampleServices.filter(s => s.category === 'Cleaning').length} cleaning services`);
        console.log(`   - ${sampleServices.filter(s => s.category === 'Plumbing').length} plumbing services`);
        console.log(`   - ${sampleServices.filter(s => s.category === 'Electrical').length} electrical services`);
        console.log(`   - ${sampleServices.filter(s => s.category === 'Handyman').length} handyman services`);
        console.log(`   - ${sampleServices.filter(s => s.category === 'AC & Appliance').length} AC & appliance services`);
        console.log(`   - ${sampleServices.filter(s => s.category === 'Grooming').length} grooming services`);
        console.log(`   - ${sampleServices.filter(s => s.category === 'Beauty & Personal Care').length} beauty services`);
        console.log(`   - ${sampleServices.filter(s => s.category === 'IT Support' || s.category === 'Web Design' || s.category === 'Software Development').length} IT services`);

        await mongoose.connection.close();
        console.log('🔌 Database connection closed cleanly');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed with error:', err.message);
        process.exit(1);
    }
};

seedData();