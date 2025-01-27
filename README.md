# Recipe App

A simple recipe app built with Node.js, Express, MongoDB, and React. This app allows users to create, view, and manage their recipes with a user-friendly interface.

## Features

- User registration and login
- Create, view, and delete recipes
- Edit recipe details
- Secure authentication (via cookies)

## Technologies

- **Backend**: Node.js, Express, MongoDB
- **Frontend**: React

## Setup

### Prerequisites

- Node.js and npm installed
- MongoDB instance

### Installation

1. Clone the repository:
   ```sh

   git clone https://github.com/shirap2/recipe-app.git
      ```


2. Install dependencies:

   ```

cd recipe-app
npm install
   ```

3. Set up environment variables: Create a .env file in the root directory with the following variables:

   ```

MONGO_URI=your_mongo_database_uri
NODE_ENV=development
   ```

4. Run the server:
```
npm start
```