# Recipe App

A simple recipe app built with Node.js, Express, MongoDB, and React.

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
   ```

   git clone https://github.com/shirap2/recipe-app.git
      ```


2. Install dependencies:

```sh
cd recipe-app
npm install
   ```

3. Set up environment variables: Create a .env file in the root directory with the following variables:

```sh
MONGO_URI=your_mongo_database_uri
NODE_ENV=development
```

4. Run the server:
```sh
npm start
```