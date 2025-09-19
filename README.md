# 🚗 Car Showroom Platform  

A modern **car showroom web application** built with **Next.js 14, AWS CDK, Cognito, DynamoDB, API Gateway, Lambda, and S3**.  
This project provides a seamless experience for both **customers** and **admins**, with secure authentication, car browsing, test drive bookings, and profile management.  

---

## ✨ Features  

### 👥 User Management  
- AWS Cognito authentication (sign up, sign in, log out)  
- Profile management: update name, phone, status, and upload avatar  
- Role-based access (Admin vs Customer)  

### 🚘 Car Management  
- Public car browsing without login  
- Detailed car view with specs (engine, transmission, drivetrain, etc.)  
- Car images served securely via CloudFront + S3  
- **Admin-only**:  
  - Add new cars  
  - Edit car details inline  
  - Upload or replace car images  

### 📅 Bookings  
- Customers can book test drives by selecting a car and choosing a time slot  
- View and manage personal bookings  
- Cancel bookings when needed  

### 🖥️ UI & UX  
- Clean, responsive design with TailwindCSS  
- Modern login modal styled with AWS Amplify UI theme overrides  
- User-friendly forms and buttons  
- Optimized for mobile & desktop  

### ☁️ Infrastructure (AWS CDK)  
- **DynamoDB tables**: Cars, Users, Bookings  
- **Lambdas** for cars, users, bookings  
- **API Gateway (HTTP)** with public & protected routes  
- **S3 buckets** for web hosting and images  
- **CloudFront distribution** for CDN + image hosting  

---

## 📦 Tech Stack  

- **Frontend**: [Next.js 14](https://nextjs.org/), [TailwindCSS](https://tailwindcss.com/), TypeScript  
- **Backend**: AWS Lambda (Node.js), API Gateway, DynamoDB  
- **Auth**: AWS Cognito (Amplify Auth integration)  
- **Infra-as-Code**: AWS CDK (TypeScript)  
- **Storage/CDN**: Amazon S3 + CloudFront  

---

## ⚙️ Setup  

### 1️⃣ Clone the repo  
```bash
git clone https://github.com/YOUR_USERNAME/car-showroom.git
cd car-showroom
```

### 2️⃣ Install dependencies
```bash
npm install
```

### 3️⃣ Environment variables
# Cognito
NEXT_PUBLIC_REGION=us-east-1
NEXT_PUBLIC_USER_POOL_ID=your_cognito_user_pool_id
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your_cognito_client_id
NEXT_PUBLIC_IDENTITY_POOL_ID=your_identity_pool_id
NEXT_PUBLIC_COGNITO_DOMAIN=https://your-domain.auth.us-east-1.amazoncognito.com

# App
NEXT_PUBLIC_API_BASE=https://your-api-id.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_CDN_BASE=your-cloudfront-domain-name
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/auth/callback

### 4️⃣ Deploy infrastructure
```bash
cd infra/cdk
npm install
cdk deploy
```

### 5️⃣ Run the web app
```bash
cd apps/web
npm run dev
```

🚀 Future Improvements

🔍 Search and filter cars by brand/model/year
📊 Admin dashboard with analytics
📧 Email notifications for bookings
🌍 Multi-language support

📄 License

Mohammed Suleiman © 2025 — Car Showroom Project

🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you’d like to change.
