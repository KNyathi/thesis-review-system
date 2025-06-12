# Server Functionality (Thesis-Review-System)
## The application was developed using NodeJS for backend, MongoDB as database, and Typescript as programming language.

## Key Points
1) Clone the repository using the command below
   ```shell
   git clone ....
   ```
2) Server is running in port 8000. You may adjust the ports to fit your preferences in the .env file with the following ENV Variables to fill in:
- PORT = 8000
- ORIGIN =["http://localhost:3000"] 
- DB_URL = 'mongodb://localhost:27017/thesis'
- NODE_ENV = development
- JWT_SECRET=******

3) Install dependencies:
 ```shell
   npm i 
   ```
4) Run server (development mode):
```shell
   npm run dev 
   ```
5) API endpoints
- ### Auth Routes
- #### Register (http://localhost:8000/api/v1/register) POST (response is jwt token sent to client)
  ```
  {
    "fullName": "Banana Apples",
    "email": "apples@gmail.com",
    "password": "********",
    "institution": "****",
    "role": "reviewer" (other option is 'student')
   }
   ```
- #### Login (http://localhost:8000/api/v1/login) POST (response is jwt token, user (id, role))
  ```
  {
  "email":"apples@gmail.com",
   "password": "*****"
   }
   ```
- #### Me (http://localhost:8000/api/v1/me) GET (response is user details)
- #### Logout (http://localhost:8000/api/v1/logout) POST (response is logout message)
- #### Profile (http://localhost:8000/api/v1/profile) PATCH (partly update) (response is user details)
  
  *student*
 ```
  {
  "fullName":"Banana Apples",
   "institution": "Apples Org",
   "faculty" : "IT",
   "group" : "BVT2209",
   "subjectArea": "09.03.01 Information Science and Computer Engineering",
   "educationalProgram": "Artificial Intelligence",
   "degreeLevel": "Bachelors",
   "thesisTopic":"AI in Unmanned Aerial Vehicles"
   }
   ```

*reviewer*
```
   {
   "fullName": "Banana Oranges Orengovich",
   "institution": "Oranges Org",
   "positions": "Dean of IT Faculty, CEO at RoboTech"
   }
   ```

*admin*
```
   {
   "fullName" : "Banana Oranges",
   "institution": "Oranges Org",
   "position": "Manager"
   }
```
- #### Password (http://localhost:8000/api/v1/password) PATCH (partly update) (response is success message)
  ```
   {
      "currentPassword": "****",
     "newPassword":"***"
   }
   ```
6) 

