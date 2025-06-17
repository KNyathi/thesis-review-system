# Thesis Review System

### The project aims to review *"theses"* for students in Bachelor's and Master's level of education. Through modern technology stack, a web application is developed with different functionalities for three different users (admin, reviewer, and student).

### Admin roles:
1) Assign/Reassign theses to reviewers
2) Approve reviewer accounts
3) Add or remove students and/or reviewers in the platform

### Reviewer roles:
1) Make reviews to student theses
2) Submit feedback with review grade

### Student roles:
1) Submit pdf file of thesis for review
2) Fill in the correct details before submission

### Deployment
#### 1) Self-hosting (Docker)
   Uses docker-compose to run the containers at once. The commands are as follows:
   a) Build docker images
     ```
     docker-compose build
     ```
   b) Run containers
     ```
     docker-compose up
     ```
     
#### 2) Render (Both Client and Server), Vercel (MongoDB)
   Client Url: https://thesis-review-system-1.onrender.com
   Server Url: https://thesis-review-system.onrender.com
   MongoDB Atlas:
   
## The Client is in the client directory (developed with ReactJS) and The Server is in the server directory (developed with NodeJS, Typescript, MongoDB) and they are both connected using Axios.
## Assessment of thesis using Machine-learning is also implemented through backend.

#### *For further instructions, open each directory containing corresponding information for each of the two parts of the application (Client and Server)
