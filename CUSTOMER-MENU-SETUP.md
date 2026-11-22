# TexOS Customer QR Menu

## Included
- QR route: `/menu/:qrToken`
- Resolves the QR token through `GET /api/public/menu/{qrToken}` and displays
  the restaurant and table data returned by the backend
- Category filters, search, dish cards, item quantity controls
- Cart drawer and order review
- Places orders through `POST /api/public/orders`
- Order confirmation and bill summary screen
- A Track My Order button on every QR menu
- Guest order history scoped to the browser's server-side session and
  restaurant; logged-in customer orders are scoped to their restaurant account
- Live status updates through the existing STOMP order topic
- Loyalty sign-in prompt UI

## Run
1. Configure MySQL connection settings for the backend and make sure MySQL is
   running.
2. From `TexOS-backend`, start the backend:
   `.\mvnw.cmd spring-boot:run`
3. From `TexOS-frontend`, create `.env` if needed:
   `VITE_API_BASE_URL=http://localhost:8080`
4. From `TexOS-frontend`, run `npm install` if needed and start Vite:
   `npm run dev`
5. Open:
   `http://localhost:5173/menu/YOUR_QR_TOKEN`

The QR code generator points to `http://localhost:5173/menu/{qrToken}`.

## Backend integration notes
- Menu endpoint: `GET /api/public/menu/{qrToken}`. Restaurant name, address,
  phone, table number, categories, and menu items are resolved from that QR
  token's active table and restaurant.
- Order endpoint: `POST /api/public/orders`
- Customer's restaurant-scoped order history:
  `GET /api/public/orders?qrToken={qrToken}`. This returns only orders
  authorized by the current server-side guest session or that customer's
  restaurant account.
- Individual order and bill GET endpoints require the same session/account
  authorization; the QR token alone does not grant order access.
- Order request body sent by this UI:
  ```json
  {
    "qrToken": "YOUR_QR_TOKEN",
    "items": [
      { "itemId": 1, "quantity": 2 }
    ]
  }
  ```
- Customer fetches include the backend session cookie. The backend must allow
  credentialed CORS from `http://localhost:5173`.
- Online payment is displayed as coming soon because a payment gateway has not yet been integrated. The current checkout uses pay-at-table / pay-later.
- Customer login is available for restaurant-specific personalized features;
  guest menu browsing and ordering do not require login. A full loyalty
  points/rewards experience is not yet available.
