PROJECT PROPOSAL

![mfu\_02][image1]

PARKING MANAGEMENT SYSTEM

TRIDSADATE GREATSANGTHONG  
NANTAWUT PANAN  
THANATHIP PITAKSIN  
PATTAKORN JAIJIT

BACHELOR OF ENGINEERING   
IN COMPUTER ENGINEERING 

MAE FAH LUANG UNIVERSITY   
2026   
© COPYRIGHT BY MAE FAH LUANG UNIVERSITY   
**PARKING MANAGEMENT SYSTEM**

  **TRIDSADATE    GREATSANGTHONG**  
                         **NANTAWUT       PANAN**  
                         **THANATHIP      PITAKSIN**  
                         **PATTAKORN     JAIJIT**

A COMPUTER ENGINEERING PROJECT SUBMITTED TO  
MAE FAH LUANG UNIVERSITY IN PARTIAL FULFILLMENT OF  
THE REQUIREMENTS FOR THE DEGREE OF  
BACHELOR OF ENGINEERING  
IN COMPUTER ENGINEERING

MAE FAH LUANG UNIVERSITY   
2026  
© COPYRIGHT BY MAE FAH LUANG UNIVERSITY 

ii

**PARKING MANAGEMENT SYSTEM**

 **TRIDSADATE    GREATSANGTHONG**  
                         **NANTAWUT       PANAN**  
                         **THANATHIP      PITAKSIN**  
                         **PATTAKORN     JAIJIT**

THIS SENIOR PROJECT HAS BEEN APPROVED TO BE A PARTIAL FULFILLMENT OF THE REQUIREMENTS FOR THE DEGREE OF BACHELOR OF ENGINEERING   
IN COMPUTER ENGINEERING 2026 

EXAMINING COMMITTEE

..................................................................... ADVISOR   
                          (Asst.Prof. Mahamah Sebakor )

............................................................... COMMITTEE  
                         (Asst.Prof. Surapol Vorapatratorn)

............................................................... COMMITTEE  
                     ( Mr. Noppakan Pinit  )

© COPYRIGHT BY MAE FAH LUANG UNIVERSITY  
iii

**ACKNOWLEDGEMENT**  
	  
		This project will not be successful without the kind support of the advisor, committees and all supportive persons. We would like to thank everyone for their advice and help. We are also grateful to our parents and friends for their continuous encouragement throughout this project. This accomplishment would not have been possible without them. Thank you.

Tridsadate   Greatsangthong  
Nantawut    Panan  
Thanathip   Pitaksin  
Pattakorn    Jaijit

iv

**Title**				Parking Management System

**Author**			Tridsadate Greatsangthong  
Nantawut Panan  
Thanathip Pitaksin  
Pattakorn Jaijit

**Degree**			Bachelor of Engineering  
				(Computer Engineering)

**Supervisory Committee**		Asst.Prof. Mahamah Sebakor 		Advisor  
					Asst.Prof. Surapol Vorapatratorn	Committee  
					Mr. Noppakan Pinit			Committee	

v

**Abstract**  
This senior project presents the development of a “Parking Management System” designed to address the growing challenges of vehicle congestion and inefficient parking space utilization in modern environments. 

The proposed system leverages existing CCTV infrastructure combined with AI-based detection technologies Ultralytics YOLO26 to provide real-time monitoring of parking slot availability. The system also has License Plate Recognition (LPR) and Facial Recognition to enhance security and automate data collection vehicle entry and exit parking.

The expected outcomes to improved parking space utilization and enhanced security for vehicles and users.  
	  
**Keyword: Parking Management System, YOLOv8, License Plate Recognition, CCTV**

vi

**CONTENTS**

**ACKNOWLEDGEMENT								 iii**  
**Abstract											 v**  
**LIST OF TABLES									 vii**  
**LIST OF FIGURES									viii**

**CHAPTER 1 INTRODUCTION							 1**	  
	1.1 Background and Rational							 1  
	1.2 Objectives 									 1  
1.3 Scope 										 2  
1.4 Methodology									 2  
1.5 Plan										 3  
1.6 Expected Result								 3  
1.7 Place and Equipment								 4	

**CHAPTER 2 LITERATURE REVIEW						 5**  
	2.1 Related Research								 5  
2.2 Related Technology								 5  
2.3 Related Work									11

**CHAPTER 3 METHODOLOGY							14**  
3.1 System Diagram 								14	  
	3.2 Use Case Diagram								17  
	3.3 UI Design 									19

**CHAPTER 4 EXPERIMENT AND RESULT					22**   
	4.1											22  
**CHAPTER 5  CONCLUSION AND DISCUSSION**  
**REFERENCES**										23  
vii

**LIST OF TABLES**

**Table												Page**

Table 1 Working Plan									   3

viii

**LIST OF FIGURES**

**Figure 											Page**

Figure 1											   5

Figure 2											   6

Figure 3											   7

Figure 4											   7

Figure 5											   8

Figure 6											   8

Figure 7.1											   9  
   
Figure 7.2											   9

Figure 8											  10

Figure 9											  10

Figure 10											  11

Figure 11											  16

Figure 12											  17  
   
Figure 13											  17  
   
Figure 14											  18

ix

**Figure											Page**

Figure 15											  19

Figure 16											  19

Figure 17											  20

Figure 18											  20

Figure 19											  20

Figure 20											  21

Figure 21											  21

**CHAPTER 1**  
**INTRODUCTION**

**1.1 Background and Rational**	  
	Nowadays, more people prefer driving their own cars for comfort and privacy, leading to a steady increase in car ownership. This rise in vehicles causes more traffic and makes it much harder to find parking, especially in crowded or indoor parking lots. Traditional or manual parking management forces both drivers and staff managers to locate available spaces manually. This unorganized approach results in a significant waste of time, increased energy consumption, and unnecessary stress.  
	  
	To solve this problem, this project proposes development of a "Parking Management System." Included with Camera detection system and existing CCTV monitoring infrastructures. The system delivers real time parking availability without the need for expensive ground hardware detection. As a developer, the core objective is to create a seamless, high-performance ecosystem accessible to all users.

	At lease, this project aims to improve and optimize enterprise solutions offering a scalable, parking management system platform that saves time, reduces energy waste, and optimizes space utilization effectively.

**1.2 Objectives**   
	1.2.1 To maximize available parking, reduce unused spaces and much efficient turnover.  
	1.2.2 To implement a centralized data management system for recording and analyzing parking usage patterns in future planning.  
	1.2.3 Enhance security parking for unexpected scenarios to users. 

**1.3 Scope**   
	1.3.1 General User  
1\) Check parking locations to see where buildings are empty or    not.  
			  
	1.3.2 Staff   
			1\) Monitoring for checking available cars for parking.  
			2\) In case have an emergency with parking staff can manage  
                                    to resolve the problem with any scenario.

	1.3.3 Admin   
1\)  Create and maintain the system, manage staff, and collect the data to store in the databases.

**1.4 Methodology**  
	1.4.1 Proposal preparation and defense  
1.4.2 Literature review and requirement gathering  
1.4.3 System analysis  
1.4.4 System design  
1.4.5 Senior project document preparation  
1.4.6 System development  
1.4.7 System testing  
1.4.8 Presenting the system

**1.5 Plan**  
**Table 1\.** Working Plan  
	

|  | Senior Project 1 |  |  |  |  | Senior Project 2 |  |  |  |  |
| ----- | ----- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Plan/Month** | Jan | Feb | Mar | Apr | May | Aug | Sep | Oct | Nov | Dec |
| Proposal preparation and defense  |  |  |  |  |  |  |  |  |  |  |
| Literature review and requirement gathering  |  |  |  |  |  |  |  |  |  |  |
| System analysis |  |  |  |  |  |  |  |  |  |  |
| System design |  |  |  |  |  |  |  |  |  |  |
| Senior project document preparation |  |  |  |  |  |  |  |  |  |  |
| System development  |  |  |  |  |  |  |  |  |  |  |
| System testing  |  |  |  |  |  |  |  |  |  |  |
| Presenting the system |  |  |  |  |  |  |  |  |  |  |

**1.6 Expected Result**  
	1.6.1 Parking spaces are utilized effectively with better organization.  
	1.6.2 Reduced parking traffic congestion.   
	1.6.3 Security and support for parking will be upgraded.

**1.7  Place and Equipment**    
	1.7.1 Place   
Mae Fah Luang University (Test at E4 Building Floor 4\)

1.7.2 Hardware   
1\) Computer/Laptop   
2\) CCTV (รุ้นไร  รุ่นใหญ่เส้นใหญ่KUY YAI CAMERA)  
		  
1.7.3 Software   
1\) Visual Studio Code  
2\) MongoDB (Database)  
3\) [Node.js](http://Node.js) (Back-end)  
4\) [vue.js](http://vue.js) (Front-end web)  
5\) Scalable Vector Graphics  
	6\) Roboflow (Dataset)  
7\) Google Colab (Training dataset to detection model)  
	8\) Python and yolov8 (Model detection)  
	9\) Figma (UI Design)  
	

**CHAPTER 2**  
**LITERATURE REVIEW (เอา ref มาใช้กับ project ยังไง)**

**2.1 Related Research (Theory from ref)**  
	  
	**2.1. How to manage parking works?**  
	  
	**2.1. Why is parking management using multi-object tracking with yolo?**

	**2.1. How computer vision-based for parking slot management is applied with prepared datasets?**

	.**2.1. What is LPR?**

	License Plate Recognition (LPR) cameras. commonly known as license plate reading cameras are more than just standard surveillance cameras. They are intelligent systems that integrate AI and advanced image processing technologies to enhance security and improve the efficiency of various management systems.  
	

**Figure 1** License Plate Recognition

**2.2 Related Technology**

	**2.2.1 Visual Studio Code**   
	  
	Visual Studio Code is one of the popular text editors used by professionals     and recommended to new coders. Being one of Microsoft’s renowned software, VS code is free to use, open-source, and compatible with Windows, Linux, and macOS  
		  
![][image2]  
**Figure 3** Visual Studio Code

	**2.2.2 Figma**

	Figma is a web-based design tool used for creating user interfaces (UI) and user experiences (UX) for apps and websites. It works directly in your browser and allows real-time collaboration.  
![][image3]  
**Figure 4** Figma  
	  
**2.2.3 [Vue.js](http://Vue.js)**

	Vue.js is a JavaScript framework for building user interfaces. It builds on top of standard HTML, CSS, and JavaScript and provides a declarative, component-based programming model that helps you efficiently develop user interfaces of any complexity. Vue is designed to be flexible and incrementally adoptable. Depending on your use case, Vue can be used in different ways by

**2.2.3.1** Enhancing static HTML without a build step  
**2.2.3.2** Embedding as Web Components on any page  
**2.2.3.3** Single-Page Application (SPA)  
**2.2.3.4** Fullstack / Server-Side Rendering (SSR)  
**2.2.3.5** Jamstack / Static Site Generation (SSG)  
 	**2.2.3.6** Targeting desktop, mobile, WebGL, and even the terminal

**Figure 5** Vue.js

**2.2.4 Scalable Vector Graphics**   
	  
**2.2.4 [Node.js](http://Node.js)**

	Node.js is a runtime environment that allows you to run JavaScript on the server side (not just in the browser). It is built on Chrome’s V8 engine and is widely used for backend development.

**Figure 6** [Node.js](http://Node.js)

**2.2.5 MongoDB**

	 2.2.5.1 MongoDB  
	MongoDB is a document database designed to help developers build modern applications faster. It stores data in flexible, JSON-like documents, making it easy to model data the same way your application code uses it. The flexible schema lets you evolve your data model without downtime, iterate quickly, and easily handle non-uniform data. 

**Figure 7.1 MongoDB**

	

**2.2.5 Roboflow**  
Roboflow is an end-to-end computer vision platform that helps developers and businesses label image and video data, train vision AI models, build application logic, and deploy them in the cloud or on edge hardware. Founded in 2019 by Brad Dwyer and Joseph Nelson, it is used by over two million developers and more than half of the Fortune 100

**Figure 7.2 Roboflow**

	**2.2.6 YOLOv8**  
		YOLOv8 was released by Ultralytics on January 10, 2023, offering improved accuracy and speed over previous YOLO versions. Building upon those versions, YOLOv8 introduced new features and optimizations that made it a strong choice for [object detection](https://www.ultralytics.com/glossary/object-detection) and other vision tasks across a wide range of applications.  
	

**Figure 8** Ultralytics YOLOv8  
	  
**2.2.7 Python**

	Python is a high-level programming language that is very popular because it is easy to use and its code is quick to understand, unlike some more complex languages such as C or Java. It is suitable for both beginners and professionals and Can works on cross-platform with Windows, Linux, and macOS.

![][image4]  
**Figure 9** Python

**2.3 Related Work (How to working from ref)**

	**2.3. How to create a parking map slot in the frontend website?**  
	  
	

   
											  
	  
**2.3.2 How LPR (License Plate Recognition) cctv cameras work?**    
		  
		2.3.2.1 License Plate Capture 

When a vehicle enters the designated detection range, the LPR camera automatically captures an image of the license plate with high speed and precision. Regardless of how fast the vehicle is moving or the lighting conditions (day, night, glare), the camera is capable of producing a clear and readable image. 

		2.3.2.2 AI-Based Analysis 

The captured plate image is then processed by intelligent software using OCR (Optical Character Recognition) and AI (Artificial Intelligence) technologies. The system analyzes and extracts characters, numbers, and even regional identifiers (such as province names) from the license plate with high accuracy.

		2.3.2.3 Conversion to Digital Data 

After analysis, the system converts the visual information into a digital format, such as: “ กข 1234 กรุงเทพมหานคร” (example equivalent of a Thai plate). This structured data can then be easily used across multiple applications and systems.

		2.3.2.4 Storage and Processing 

The recognized license plate data is stored in a database along with timestamps and captured images. This allows for

- Historical tracking and verification  
- Integration with access control systems (entry/exit management)  
- Real-time alert systems (e.g., blacklist/whitelist detection)

	**2.3. How to track multi-object with yolo?**

	**2.3. How does EasyOCR work with license plate recognition ?**

**CHAPTER 3**  
**ANALYSIS AND DESIGN**

**3.1 System design**

	The workflow of the Parking Management System is designed to streamline the user experience through automation and real-time data. The process is summarized as follows

	3.1.1 User role

All users can access the system immediately. But if you have an registered account, you can log in to the system. Login with the account will receive parking history. By default will be a guest user.

3.1.2 Real time Checking 

Both user types proceed to display a building real-time map of parking slots. The system shows slot availability if a slot is occupied, the user is redirected to another parking slot. The parking slot will be checked by the parking line with YOLOv8 and send data to the building map.

3.1.3  Parking time Collection 

Once the vehicle enters a parking building, CCTV in the entrance lane will capture the license number and face recognition. When parking, the CCTV system will snapshot every 5 seconds. Parking slots will be detected for 2 scenarios, 

1\. Vehicles not parking will see a parking line. 

2\.  Vehicles park will not see parking lines.

Parking vehicles will detect license numbers again to confirm parking. This module uses YOLO26 to recognize license plate numbers. After processing this data will be stored, updated slots and kept in the database.                              


3.1.4 Data collecting

 Captures all metadata (License numbers, parking slot number and entry time) is transmitted to the webpage and stored in the database.

3.1.5 Exit & History Management 

When a vehicle exits the parking slot, the CCTV snapshot to find the parking line and license plate at vehicle exiting. After exit the parking slot, CCTV in the exit lane will detect the face for verification that the user has the same face as they entered. 

The data that was detected will update the database. Guest users only complete the process and history log only staff can access in their, while MFU account users are received Parking history information details to view their parking logs.

**Figure 11** System Diagram

**3.2 Use case diagram**  
	  
	**3.2.1 User**

**Figure 12** Use case diagram for user  
	  
**3.2.2 Staff**

**Figure 13** Use case diagram for staff

	**3.2.3 Admin**

**Figure 14** Use case diagram for admin

**3.3 UI Design**

**Figure 15** Parking map, History and Chat support for user

**Figure 16** UI Design for dashboard in Staff

‘

**Figure 17** UI Design for Support and History in Staff

**Figure 18** UI Design for History and Support in Admin

**Figure 19** UI Design for Add & Edit in Admin

**Figure 20** UI Design for Add or Edit Buildings & Floors in Admin

**Figure 21** UI Design for Add & Edit Cameras in Admin

**CHAPTER 4**   
**EXPERIMENT AND RESULT**

**Conclusion**

	Summarize what you have done in the senior project.

**CHAPTER 5**  
**CONCLUSION AND DISCUSSION**

**REFERENCES**  
\[\] “Complete Guide to Parking Management” \[Online\]. Available [https\://www\.propark.com/2026/08/04/complete-guide-to-parking-management/\#what-is-parking-management](https://www.propark.com/2026/08/04/complete-guide-to-parking-management/#what-is-parking-management) 

\[1\] “Visual Code Studio” \[Online\]. Available: [https\://coderspace.io/en/blog/what-is-visual-studio-code-what-is-it-used-for/](https://coderspace.io/en/blog/what-is-visual-studio-code-what-is-it-used-for/) 

\[2\] “Node.js” \[Online\]. Available: [https\://nodejs.org/en/about/](https://nodejs.org/en/about/) 

\[3\] “ MongoDB” \[Online\]. Available: [https\://www\.mongodb.com/docs/manual/](https://www.mongodb.com/docs/manual/) 

\[5\] “Vue.js” \[Online\]. Available: [http s://vuejs.org/guide/introduction.html](https://vuejs.org/guide/introduction.html) 

\[6\] “Figma”  \[Online\]. Available [https\://www\.figma.com/design/](https://www.figma.com/design/) 

\[\] “Roboflow” [https\://ai.engineer/orgs/roboflow](https://ai.engineer/orgs/roboflow)

\[\] P. R. L. de Almeida, J. H. Alves, R. S. Parpinelli, and J. P. Barddal, “A systematic review on computer vision-based parking lot management applied on public datasets,” Expert Systems with Applications, vol. 198, article 116731, 2022\. doi: 10.1016/j.eswa.2022.116731 \[Online\]. Available [https\://doi.org/10.1016/j.eswa.2022.116731](https://doi.org/10.1016/j.eswa.2022.116731) 

\[\] “EasyOCR” [https\://www\.llamaindex.ai/glossary/what-is-easyocr](https://www.llamaindex.ai/glossary/what-is-easyocr) 

\[7 \] “YOLOv8”  \[Online\]. Available [https\://docs.ultralytics.com/models/yolov8](https://docs.ultralytics.com/models/yolov8)

 \[8\] “Parking Management using Ultralytics YOLO26”  \[Online\]. Available [https\://docs.ultralytics.com/guides/parking-management/?fbclid=IwZXh0bgNhZW0CMTAAYnJpZBExU0o5TjZMVzRFQjQyUVJ3NHNydGMGYXBwX2lkEDIyMjAzOTE3ODgyMDA4OTIAAR5B3gnJIy92q6FhNE\_w56wdyyvq5u99GcDHApK51p0OfDtARx0f9i5QVV6\_3g\_aem\_5S6o5nAqvzMLustAEfF1Bg](https://docs.ultralytics.com/guides/parking-management/?fbclid=IwZXh0bgNhZW0CMTAAYnJpZBExU0o5TjZMVzRFQjQyUVJ3NHNydGMGYXBwX2lkEDIyMjAzOTE3ODgyMDA4OTIAAR5B3gnJIy92q6FhNE_w56wdyyvq5u99GcDHApK51p0OfDtARx0f9i5QVV6_3g_aem_5S6o5nAqvzMLustAEfF1Bg) 

\[9\] “Python” \[Online\]. Available [https\://www\.python.org/about/](https://www.python.org/about/) 

\[10\] “LPR” \[Online\]. Available [https\://www\.gtoengineer.com/lpr-camera-guide/](https://www.gtoengineer.com/lpr-camera-guide/) 

\[\] “Multi-Object Tracking with Ultralytics YOLO” [https\://docs.ultralytics.com/modes/track](https://docs.ultralytics.com/modes/track) 

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAACQCAYAAAD3Cm4hAABamklEQVR4Xux9CXxU5dU+S9jFaqttrVqt1Vr3tVZtta3auqEoioKAskNWEpKQsCcQAgQI+74vISyBsAcIW1jDkkAgLAkhG9kI2deZycw8//Ocd6K2tfavn5/F79eL15nM3Llz71me85zznvedJviBbA75Bzj1P4dN/nI6UG8BSipsqLcDNocNzgZ528FDHDzsB7E1+ccXbtTNiF8k7XSqgK12G4KGzcH5y2UIHBqBgmuFsNtU+vJfg0sB/NSNvf1gFGAEKgpQX7CL1VuxYOl+lNUBw0fPRGFxMRosVNCXFcDjb+ztB6MAY8sNuttE+DZ5ZXDwYkyevRUFxYCFsMS3VQG2/yrgu96+EKhd/okS5P/9PSOx/1guzqdVoYEaIgLZCVGNCvgvBH1n25cF6nAICDlFAQPHoFoCccym4xITYPTzdxB0428/IAVQpIYFUQ8OUcCQoEgQ9qfPihFYkrcazPv/VcB3vlGcNtdzK+yigHorMHnqFqRcKoV/4FxU1PAo8YwGakJoqHBSxw9ACz8QBXBrxHMJwCLZmnoIDV2FBcsPo0u30Tiffl3igEkEnKSqTrKlG18DPxwFqGChu0V0sWlbMlZvSMWf3xiMdVsu4qXXegs1tTNDMMmYpgSWfzzLDbf9QBRAyduMAkSw5TVWSb5mYVjYMgSFLsXCqET09pikirH/VwH/Gxvhp/ZzwVZJ8jXIfwLKJQ5UyzupV2x45Ol3lAnZWY9wBWvGhBt9+4EogFjusmxCkMh4X0IKCsqAShH6ybPX8f5HHmD8NYKXY4Ul3fgR4AejAJgkS4VbpzmAVZQwYOA0+AZOh7v3WOTkV6mCjNHXgqxJ/77Btx+GAlwslOhiF64veRhs8ve2uJPiBVYsWxePo8dz5UWnOc5Rr1ULZyNzvYG3H4YCyO+dNaiSmJp33Ybde68iLGw3IiKPY+biE1ix7jI+7haJi5fLUVQC1DnEQxw2UZb1H090w20/CAUws7WiDOu3nEXHzhH4+c8HoG2rvmjd2gtubfqiXdsB+FF7dzzxjAfe6hiCg8ezNEP+AcTgH4oCnKh3WPGLu7rhlh/3FNxfjUUrjmB/Yi6SLlXgyMki7NlfhIChG/DCyyPw3AvuqKjkB298DPrBKMAqwhzgPR3HTtejQpCFe6XsJfVOVImcKwWeODaQJxD0ae9w1EoYcKgb3NjbD0MBpJ4i7E96h2L8zI0Im7IK4ZPWImDIIuyMv4xR41Zj5rw4TJoag/DJG9G1+0StkrJqeqNvPwwFgFkA8Pp7gZixKBHnM4GcQmDJ8gQUlgKb4tORLzlBVr4dSakV6NJjPCrFK+ob/gtB33DT+oFrZyJVhwaHE1t3XMALr4agebueaN7WHU3beKBp6/5o0boPWrXphyYte6FVu95wazlQHgfgVw8PwOsdh6POzjOakpzZ6RHMlF3fcwNsN5QCHLAYubhKDiwn04ifeFIE3vYzNGvrIcIegGY39cItdw7AA4/74aEnA/Dbh0Nxx12eaN3KCy1aDBBFuKOdsKNKLVHXmxN+eWvUyA2w3WAKYDXTBF2WExpEIYyj777vjtPnilEizKZK5Fkrr1lEgLVWs9cQbuxWgRx5X/7OKnLg5JnrwoSYOn9en/iS0OkVNwY83WAKaJQR4ccClpbt8kLXHj6olseCcguyCmtx5FQW4hNSMXfResxdvA7R63bjQEISTp8pwJUcC8rYL1TrQEVV40npUhyoadSCVV5mueI/v91QClBhKVoQp21gmw8Lb7/7fVf06jUD5y6UoqSiAeXV9SgVHrp8ZTzKKoD4gzlKRYn512trsWHnRQz0WYzSGjN2YHNUi9iJR87PtXyjjJbdWAr4HCbYdNIAofgqxG17r+Hltyajc8+5eLvzRDzxnOD+4/644x4vPP3CODz9oj+6fDoJY8btQdT6K+jScwWeeykUpQJXNQJJVsYTLQ59AUX/VcBXbIQc7rR/YvvNt72H5m26oGkrBl9/uLUZhBZtvNC67SBhP15oeZOwoJs/lUcJwO37yXu9hQX1h1v7Pmgm7KiFBOWb2n+GaTN2ou7zshAlXyffw5GE//x2QylA4cEVM6tEPm6tP0HzVn3Q+uY++PldAXj51al494O5CBgai9Fh2zF5+l5MmByHiKm7MG7SVvgEr0S3fnPx7B/D8esHQ+DW3BduTQfD338dapmY8TvUCeqhbY43wHZDKYAtV06xTDbeVkuM3LgtCQUl4g02VpoFRARCmBc0NDhgk52JrpanORJmJ9ab6GF18tEpn7OjSALxuMkLUcdStW5kQDdO28oNpQAKzy7BkiKiAhKOnVG6abE7VKiVEmWrietizZXy/rUyK7LzylAqEZhd0tcrHajk+6KcWodNwaxGzjVp+oIvQdB/FfAvN2WKDWwpgQo6YMR8DAtdAU/fCRgVOhXxe88gPaMS1XVQSImO2a1Bdk/COVEOtP6TmVeO5VG7EDZ+Gfq5RyAoJErgaZl4AMeLofWhBqdNdiZo//nthlKAw1YHp0AFBcWE6pUOIzAifC8OnazDlTw7rl4DcgqAS5nAmfM2zJy/FxevAFt2ZiKvWCioxI0ioaWF5XJckXjQ8SrMXJyCuUvjdDDH2iAgp22N2l/9j1//H9luLAUw8xVL7dV7Kp55PhDtf+ojjGYgmrTqjSZt+6KJsJwmbXrJ8z76d3OWJloNRNM27mjWVo5r08ccK383aeuNJu280e7nHrj/US88/4chSDyRpmPJdjJSBbz//HZDKaBGgmadyOWmmzoLhRwg1HMQmrh5oJmbN1q09sSPfuKNH//UC/fe74v7ZH/gN4Px0CNB+O0jfnjgQT/c+ys//PKewWj3o/5o2a63KIWFOh+hpj5o0aIvvH0iUSeGr3UmRu4bYPsPKIBlARg66NrNkwZhOAIM4gGTIvfi4PFyhRFCUX29yYiZULE2xEdOS2Ltp1b+4Ht8vYH4TibEY2SvkkBdIbHhYoYVicnl8PaP0FjB3lLTMvGvQvG/ev27375nBfDGvmx5FELjbkeD8Eha6MkzBaiVQ2vIfCy1OheMnlFcXo/s/BIcPXVOAu8JrIjegsUrNmLDpiPYuecUzqVmIf1yISqrDVOikmobLIL2DtQITw0eOQY1PJG2TjAR+/4E/a+271kB3ChsQzgNHbRoDZSBlzyedLHLZ2MRHLISC1YewPY953HqbCXOpFUjQwJwep5DdiAjH1i46giyxUu2xF9BgQTevFIW7IBsCchpV+uRmJqPvUfSMG3udgQMWwCfgAjTRU02dGOEgP+EArjx7tlsy+ESixaGCT3XKoHLucAzL47Ax59FYcykRPgGbcJ7H0Xib+9MxjN/GIpHnx2MB5/wwW8e98Hd9w/Q8YBHnhmMP742Gu90noiuPWdj8PBNGDvlABZGn0P0lkuYsyQNQ0P2IXL2fmVSFbVG0Z8XR7n9h5zh+1eA3qgpjJH3k5OXChq88dYQCbj94NbGH01bBsrzADRtJeympafsveDW+lMd9Wp7c3/cdIsE5B/74uZbAmQPxI9uGYpbbg3CzTcPwk3tvdC23QC0EqbUrHU3YUU9JRC7yzkHwU3Oy4Deqt2nuPc3PppBN8Yj8z8tVnyv2/euANMuyK5lZl2K/BJsbXj2OQ+4tXBHczd3EXIPtP9xdzz8ZG+8/Jeh6NFzGnwGL0PElF2YveAQotefRcymi9i8PQPbdmVj846r8jwHa9dfxMpV5zB1+mGEjNmGvh5z8d7H4/Hg4/3R/iedcNPNfdCqdR95HIibb+3/uQIcWhptVMD36wrfuwJMGVioiEsBDU4LCkrt6DtwvgmcWvcx8cDhtGo7IuXy9+Ga77PAzF0iiZNVJCZZDSpMHcqUoMJjyJDIjPga60kcHyirAmbM2quvkRHZmRjoWf+PK4C35prG5Wqk5Yz3elwrr0R/r1EiIGbBnGZEgLap1GilSisbSCvtKK+yIf9alWTEpbiYlY3TFy8i9Uo+0nKuCb5XyrnqUF3nQLVQIM4bs8nnHFqDYKtirTyXXEMUPXdBDOrlu2xUo1MiMyukTtKB77ep/XtVgG4qfQq3QSyPk00bkH8deL/zeEydE4cps7YhYvpmRMrzqQsOYPysfZi14gwWrLqI5euyEbUxH7E7K7BtXzXCpx3EwSQHlsZcxOGzdiQkVyMhqQJ7Ewuw60g2Nu46iyXRhzF36XbMWrgREdNWYdL09Zg6/wC69ZumGTEV7KS7cXqrk8I3E8G/r+37V4B6OdNRq0IDS805QhuHjt6O1zpEYMjoPQibkoj+fuvwl/cm4rm/heJXT0uG+4g/fvZrH9x+rxduvXMAbr1rAH50Ry/c+YAXbv9Vf9zz6CA88oI/nn0lGG93HYeP+k7BkLD1iFyYKMoqRNJFB44kW7BxZwFe7TgRj70YpIP2TPJsdC+nmdj3fa8z8b0rgFbWIO5eVefErbd+gnY39UPLtp5o3tpLGIswoVaBwlj80LTFIFOCaOGDFi290LT1ADlGAnUbT7TkaJh8pnU7T7Rp5yGP3rL7oFUblizkPTmen2nu5ilMygfN5TPN2wyU5/3RTB6btJbXW5sSRTsJzNNm7dasWhM0MrTvEYO+dwWwHMyFBthK0qbtp3BzGwA3EUzz1r3Q4qZeaHlzT/zkjj64S6z62ecC8MpfRqJ795no7b5YR8JGjt2JiKmHMWnaYUTOPIZpM48icpbsM4/IawmYMGUfRozeBL+AKPTsJyyo6zQ8/WIgfvuEN34sHnPTrT3Rsl1fUSTrRIPke/uge+/J2u6i/Xfkxv+nFSCR0Sp4y9r97IV7kXSuAgUl7HSABk2iLwdfaIuGCWmsNshMtsP5v2KljB1f/KuTvy2uV8mKTO2fjw06kuZiTjy3w3RKVNc7tX/owpVaeAwK0XEF0xj2f9oDSIHMbMcqIR5bdx1FrZ1Ck1vX1MBIjkOS5CM2OVbHtTRowxU/DINq7DDRl1x/62v6umlIVD5jXtDdvC9My8GuCxssdosqPSBgAmpreQi/9fud4P2/ogBzv+ZGTIMy52tZjBlyLq+8xonWMVsTcVUYUOrl6zh+Oh079yZiS9xBrN2wE8uiYiXpWoWpsxZj7PiZGDpyKoJkHx2+AJHz5L1lu+A3ch5idqVi7KRYLFt7BBEzoxE+JQpBI+bBP2gyRo+bjAmT52D2vCgsXLoO62J3IGbzTuzem4RDR9NxMbNKqKtD4GqMGbRnPyp3sgNVqPqTuSlVCv/33TKk/yUFqE03/iH/sR5Z68JXi0IL20669wlHx84hgsHTEDh0NeL2n0PyxWtIzSjH+SsVuFJgEYZkR1E5cL3MITkAx4WBEvGeClHg0jX7cF2e7064jPJ6M1+A0Mae0LJK+UxlFQrKK+QclcjIKxW4KcYFOffWuIuYMm2HfPcovPSqOwZ4hmkS6PJFsRGLS+CmYKjbD0kBBm2Z2DgVHtjjScZfIThfIkI8nFSC2UsT8dq7s/Dw0+PQ5hYftL9tMNr92A/tbvVD6x8Jk2nvjhbtB8hrZEe94NbWAy1v8tJHjoS1aMfnwm5kb3HTILi1c5fn/eW5B9rePBit5di2P+ovez/85Oc++PHPPPDTu/vj9rv64Ge/HIDb7+yP+x8bhXc/XiW5Qg52JpQiu8iJaxWm9M0ui68WuLr0d7b97yhArYU19wateLJMwNq8f2AU/vzaeNx2Zx+0ufUzNG3rjiZtfGQfLIzEG01ayGMLoaCtfNGs9SB59NRCWnMOL7b1FfroY3Z+phUVI/RUqGeTVv7yup88DpLjfeVzAXqeZvJ3c6G0zdxkbyGvt2Bxb6C8xgKft9JRt/Y+uOk2d9x6R3/c95A7nvr9EKGlB1FdY1apczRO/P781n4oCtBduYyyHqb/bduK0Jv7iQBEuMLRm7XyFhrojVZitTf92Bv3PxiEZ34/Fu91notuvRchcOQGjBq/BdPm7cWiJYcRFX0Ka2NSsHVHGrbvSEfcTokbuy5jZ3yK7jt2nsG2uNNYv/EI1qw7iMXL92Dmgl0YM34rgobHovunS/D++wvw1BPj8atfjhTvEAVIXtBcc4x+svcVxfTHnfcMwMmUKy425coNtHb9ZVV8N9v/igLMRTLHZySjBzi1zeSWH3+An9/VC48+5YU//3U4AoatRURkPBKOXcP5y1alolyGgMdq67nN9HZqQc1mdpv83cC/SVkbdzJH1954HF/jcfXCBHgutqXwfDw3Y0RJGXA8uRqbd2RhyPD16NF7Fh55ygO/uKcn7r3/E3nviuEMDpcCXJb/A1EAAzBpBXS3NNQIBDmQns0ZLxyvNTUgViKVJX2ZU355d3mSk91wMNVNm0i8Xk5CSKsW2VQ2GGWximoRk7XaTQW0saL65XPrVIEvnZ9016C8mZegn5E9cuZSnDyT4YIg/N0F3dgKcAnMWAzrPeTvZuCFi+plcJSdZMhZBXbAMSmykpdzHgAPdVkxn1vrRZB1dtRJylxWVoOcohIcOHxc4GcP5i5Yh8lCOf1Gz0NA2GIEjV6K8VNisWjlSqxcux4HDl3CmdRMlIo7VVdZUCvnqBeNWSXDayzAcWdCZtoYqzRhozexnD19+iwkJSUZ73KYhE7rpIwH33GS8N0qoHGjpTXOTAFtx45aufYd+3OxY88ZTJq2HoMCpmJYyAyMDJuBmfOjsTpmL/YdPI3Diedx7mIeruSUoajEqntppQNV1WL1Ak9WHTNwqgdMmbUdHT8MR/zBFNSy1k/IIdxY7KiudQqk2VFc7kR+sRVXi+px7lKhWHYW9h8+hx27j2P6rFUIj5grOcNU+A2ZgjlL1yM27qgoMwonTmfJVTNhYyMvDYoLgFBBX77R//n2HSmg0fRdrupy9cbstE6sv1oE8/s/B2CAz2qsib2EhKMVKBYcvlZhVf5e6YIILQ/zFGxR5Gt8bmc5oUFxn9NVuTCTOAg+6jYS4ybE42BiGurkwxorFEbqNe6wzUUbsWjBfF0+TwhsfGRcqKxzIO8aJEdoQFTsKYRGbMFLr3si6UKewhHLH66eSTUk3tp3uf0PFPAlgYMDKyaLZI3f1PprVCC5uQ146eX+eP6l/njhtUChlO/jYrYNWfk1OHrsHOL3HseqtXFYsCwW4ZGrMGzsfIGU2cKAZiJw1Czdg0bNxoiRCxAyZhFCxy3H1JnbZd+GlLTrInhgzIR1mDIjHpEztsq+DZOn7MC4cesREirnGzUPwSPnCAuajSHDZunz4SHzMXLMQsyZsxaLlsYgdudu7Dp6DD3cl6D1LT3wyO8H4k9/G4TklBLtL+JcAhqCjqpxps13uP0PFPCF8BsauE6na0DDjHBIALTixKkidOw4BEuEDqam1+G1DmPwYdeZWC8eUFrlskbivSitXigLZ7fXSIyQBBZl5Q6UlguEXLciI7MUly6XIyklRyDkKnbvy0aPXmMgVF1CShWOJqfjhT91w+6DyTiQmIrEU1cFQq7gnFjxuYsFyMytRJ5A0LVSO66XE5pM0xbrT7X1TpTW1qFCruORZ3zx9Auh2H6wAPOXxeN3v+uNBYt2aSJJ4dMDWfr7LrdvqQBav8EZbS0R/7ZzbzCQQSp57rwdL7/ijdPnSxSvL14RAaZWQjwer/11MHr1nahcibdjMmaChpVcB1o7+tIjXyerstitmqV+2MUTmVnVqjwGRnoa29mTzxXod5kx4sZhTVdkb9wJJ/RS2R1iJA1yTqv8GTl1LY4cL8U1gcUevUJRWlGrk/ymzUgQqpqm5WqrGInaF6/Xtf9Pt/+RAshfVAGK04LNwlqqKiyYNXc3XnxxGE6cu4Yqucn8AqDje0NQ7aiXkFYnbn8Ad/yiE+RQivWLmaR6Q2aSqvEmnlvvWGRp05svK7fiQtpVszqWgrsgs7xhc1rw6WeByM7hhDxqBuqgrqs0McGVkzTuTh0nBg7E5+Px3/bUmFAvn+3wTn+sXHJA40peWT0ef2YAIqZu1+DOeMTr+o8rQNu7CSES5QKHL8dPf9kN3fstxfDQrSgsdOqIFwe8WWXs2NEX6ZerNag5RSG02IvpFjz6uLsE4yLl8GrlRv5Qz3LtDXYGP4eozYKotXsQFDxJ441+eWMYkr/ZQVFaCkyevFrgTDIRe72pxjYqVikMrZ+eQGrs1ICeK7HottvfR3TMadRr9dOppekx41eisMgi32+Wyc+8asUn3SPw7vshePipPujvMxs1khUqK1IDsn4rhvotFUBLqoRivdWK237aUaxkBDp0HonzV2p0tIvwQgVkiUUuXRqnnWjMTAlRTJBYzWx3Uyc8/Yy/ZrssVZgRKQoI5qZcnmETodXKa6PGThVoYH2p8ToorgaFLz5nTMnMLkHq+WuG6ThZhWULjIEwc36z4haFdbXYgR49JyN42CaUVBs41CxbvKlIYsXyJXs082YuwHyBcSNPvPkPr3jilw900G5uFXqjAhov6xts31IBanSaSVrkIl565WOUycUVlTZg9KjV2Hs4V6AHmDF7K958y1stqMHBCyzXC6Z35BZV42KWE8/9YQgefuYTbIxPEfHwGJ7YhWnawNkggbMSw4ZzmhG9wfT9GGcxkzmoADVuZ7V65uxZWzFx4mqdPW+EDhUSPcoqQZvTXzOv2tH+Zx/h5ts6a78ovdLp1Jq00txyUdTChQl4/W+9lQlRAV26eGNH3GGdqZ98lo3C1fr95oLMtX3T7VsrgBfKm62XYNaho6fO2bLKhZSXAw8/+Qn2HS7AO+8NRsLhK3p9pqZiYChy6kY8+0xvlMv9bt51CX/rOAaPPT8AGVdrtc2cccWpXRMsWUjCNW0xFizcAk7SszF4OukkDk3IUs4WKCYTWWwN1XxV4gQQOCRSB9rZB8RShpYzxGPrRVMJR/PwwUcReOL5YEyYKljfwFEykogq9b6KWitmrdyMZVFHMHL0QvXWYjnnrt3Jkk2zvkQFVCMnn6v4whgMafj3qwDlGXpxo4W711poAWblwvScerz88iicTr2uVq29+yL/nCwHLubk4tGH+uHZJz3knXplRa+86Y9DSVXw8F4iUNYDG7cmIzPfptOKdh9IF/pIGGKpgJ1vDLocrnTCL2C8wMdirQVp7xUdxs6aUZ3Cic/gicjOq1BoooWvWXsEH34QhslT9+Hk2VKcSi0RYmDR7PmaxK06cQ0yIuL9o78L1qlQHOj53fOfScK3mXVdUaJV16PLyKrF3gM5rm4KdS+4/veNtm+pALqcTXG5SELBnv3pSgkFXJS1UCkTI7Yr16911qLoOtCn13R4eUcidOIizFuwC3n5cuMWTpaT9zyGY97ybSiVc6WkluKe+z7Egw/3wvwlR/D2ewMkRhjc57mJ+cRkxoyRofNwQYI7oYB1JVq5GVMWS5cL2nMgFUNHLkZyai6mzojBA7/+GP36T1K43LzrGEo4+CKfe+edUXjqyYEYNz4OK1alYt+BBjz+ZAguZZjfp3n99RFIu8K1Kyhtrl9h1qEYFRKlEwY1enxz2ev2/6kAnv3vv4EwUVThRKdPRuosFEIFuFykg+O9TgwfPldeZwoDdOs+Hze3f08Tp2mLtgoFfRcho6P1HISZgMDZmDZ7HZhJs6ezpsFMtIuU1zgEqUyD98gBfEet8HEn9uxN0WFHTmOdNH2V5AA54mXk/eIhBGzCFbikGbBi9WlcK2EY5g8/mPL0nDk7FfvXrk9G994z9LgXXgpBm7YDMWPuUQT6rRKlcvVFKwb0j8TFtCIjAp2X3CDxyIl77+uIYyfzwJqRCuBb0KCvV4DrfMo0lPq5XnMaGnosMQ/3CP2kJxi0rlVBWRvqER0VL5Zv1zVJXn1rFG69rQeq5JBtB3PwyOP+ePBBd/lcvVK/jp2CsS3+rFo4YYYZ8aKl2zF63CJU1pNvk5pAlVtvFYZSUiPQM1lx32qziIVfForobxpt1RMYeM1KuywcvPbmAMTtuSAKqDNpnb0WW2JP4booZfq0IxgcsA7lcqEjhsXg5lY+6sENVs5NriXooPNHo5GZRYQ3JXaHs048owYvvuSLMRPXakXXwB8t5ZttX68A1/ZF0sHd9E6yE+f5F/th2coDhonQCvj9FKI8Mlj5+8/WMeAOH4zBLT/phF0JRzFp6nJRWge4e0zWrLZUMs9FAklkSiZZssI/cAoycmqFi0cJxBQZ2ujgHDIJ4yLR0DGLcF0Yl7WhTl63KfywyyL1fKEGZm0K4DWIIooq7HIuC3bsPi1wITgvrM0i1lsrwD8kZAnOZVtx3yOfYGt8EeYsOoyJUxPR8cNQyWUM/FwtsGD+wjg1Cnqs5hAOsjrgfHoVnn2urwZxerJTtfDNtn+jAOMCJo8xwqeYWBsvl4t7+S+euFpIG+d7jIRGEVzfn5lqly7+CJ+4EqvWn8akaXtFGVUSiIGpU9ej4Hq90EtJnKbEoFBukjSSN3K1oApHT+QgPbteFHYBkdPXK4Oy0X5FScln8k0dh5DkZHZMYCG1rZXvG4SMK6US9GkeZqBm+ep9at2EsvUx8QIdhDlTEX33gyHYtjsL3fuMFS8cjkPHLiJPkKbbp+Pkc1s1Ji1YuFc8TtgbDYuYxmSNtNdpFo8aMnQJcq7y+hp/t+abbV+rAOXk5onKuJEWknJ6Ba6WRIZNhnBRkHpNYnQWI93cSXYh1pddBHfv6Th+Ok8tlRZOdnMsOQc9ek/CeQmiVhg+Hb3+KP74Rx+kZ1nw8BPdkC9BcvOOFNTUidXKHQ8fOQunz15VJCfu0hJ5bTrzXXyS3jF//g6UVZGv8KdNNiN2+1FsjtuPK7ll2LErGd16BOhcZNJHxqpNm08jamUKSq4L9WXA4vUL3KbJl3fpPgonk/NEYawb8U51XE7+ZrnD9ObVyA2//MJIXMmp0c990+0bKIBuZgpfB4Tb3/9Qd12TwfBgZpA25fgp5/O12khF0BM4JrtsVaK46qcoLWffTr3Wih56tCs8fBbjcg6na5iV3foMGA9P7zlISqnCvfd/huXRl1Eiyj6Tch3nLuTj1Jl0Pa8OZza2vejfJgslo+ICTktX7BCG44SX73hcr6lDlx5BwmLqhDZmoGu3UAm+HE+wa7J4Ta713l99hl59JitsktWcPFuIV98OwoUr+QpDDsFUq9VYODvq2F1ntbJMwjzAhj8+Pxhh4zYYY/yG279RgMupXJmeVfyWnPmhhz9AamqxWK3JSom/u/aeQsT0lVgRfQpBw2Pw+BNdUVlj0wyS9fv77v9ArKRaYsZ+HRRnaSLvWpVg83ncfU8P3HXvRzp5LmZzgk6ke/SpQWjdxg9DRsbgcmY9rjLr1H+EgEZYNMVAvVIHg3+tCohL3WzefFQ5OhX88GO9kJErill5UpR6GL7B4+EbOE8E3x2vvxWC4hrT1BUscPLY493kGq/g7l+7o6qBMzhF4KaIpRkxr/Hdd/1w9mwR6uvqtApcLN7TocNQhaxvulbp1yuA8le186R0PeDo0UzJZPcKSyBjMVi6aPlmoZHrER17DH99KxC7DxYgZuMlwUin1oUee+IzRK0/jDq5CVJMm6bttFybBMUGTJu7Bz36TdQSwZkLV3UN0G59ZqNZ08G4/Wf99TPWBiZiZrxBFWB3KQGVwoZoKuzzZKJUb0bOBE4KJLnq8vEqvPxKIIpFKaHhm7D/+DlczK7G316PRML+XLV4AphNGI9FFHFdWENBiQXvdpmA7KumeYD/sXi37/Bx9Om7AKGjY7F9W5Jm2UQmyiA+PgOrog5/twogi1AKylq/gzewFr//w6emJYSRj0KRJClJYGfW0r14QYLylBlxOHakAJev1OhyY6Hhy3D2XK1WHnVZeWULrrAtF0sBrFu3X6cV8ZScqL1s1W4kXbCgSeseaCK08G8dwpGWdd2UNBholBbxHARJ4jKfy7Xa6R1OjTWcB/bjn/RCUzcPhE8+gGq55kG+4SgvZy4hhiAReubcjRK8ze9SmgqrnkgNiy0szz7fG/EHLsvxFoWnft6zMTgkFl16hmHNxtPIkGtiPOF1szzx1rsB+KzvFK3uao3IVTHW8rpmRP+8fa0CmPGZoONUyLj/t12wYGmcDoxTiDZLtUJTvLCVcVNjEDZpG37/4kCkZRQrHq6PTcGvH3jXlCLkghyupledTEeRyeuHDqcLJNXr+6zXU7aDBk9AmkBH8/ZcL8IHLdt2RdcekxSPraxpqLD4DawZEaN5tfzboucuF8XPXXgCrVp5oVXbQdi+p0jrThMjlqqCeV82+XL+BuUZgRLtxKZiGfMU2gyD6tgpCG+/E6DCtEiSt03g8jGJZbmlUC/18h6HkjK7FgkJw/EH0nHfb980PU20OFUNNcHHr96+VgGOBmKscPVqJwKHzRM+bcZ5oZXNOl3+JS39Ol55bRB27cvD4892RIf3vAUyapUq/u2v/oKP/Hr23YsqbdQcBUDXtmLkyHnYfyBVBUDrduhSwxZkZ9vQ32sixk46CTdO4mgZjGaiiM6fzNP6DNmH+ou6kngUm2k5lELMvwK0btcHbq290ayVP1q06gsJNcguskju4HBZJkfxyGAgGfU5VNUYuqGhjpaqXlCnqzBu3JKC+H2XPjeiVPH2u+7tIrlCCM6mWhAatlDLMIcPnlXLZ97x4YcjUVBkjEw9k6jkpEL+eft6BXAUysGfjDqLR5/sqo1QbHwi/vCCr5c6ETR0JmbM2YpXXu+DA0cykZ1nR4UkPHPm7se+fZmqMHYWGLymN1EIrGQ6ED5+sbCWev0OTTPY/SCB79zZMmFI4Tif5cQLfx6JZs0D0LTFYLS9yVs8bKyuisXsU2c12pkhsQmA3lSJt9+eLrDjC7c2weI9nrj5R5/pSuvb9pzSPILXrcHbzsSOCRnx+7SSC5NQmmyXo2WklYXFTrzdYTRyC8wAT0V5vSST+3HwaCX++EpPePiOkzgmWYrNqudgqfrZZ/tInIx1xTpCOKX5LSDIYjHU8rkXPJF0VoKdWJndyezTuGg/j5l4/k/uyL/u1JGv4jKH1ma6dAvHRx+NMwskkVzzxngx/JzgSGm5Df6DpwnOWuUmeWM2vWkOfnA0auHiTajV+lKlYvFN7fuiabNguEk8aNbCE+1u7of3Ppyh+QSbq46dKEOnD2aimVt/sXw29HqJ9fvi1ts8sXlTuh5zObMU2fnlhsay5tTAeEEbbcCRY1kYFTpXcNzkI2zOotXaG+o19kVFpQqL+1AhkzNoz6ddxdGTecgUtrZo9RlMm3lM2+Lp9cdO5qoRdnxvqF67KpVG8i9Q6GsVwOieW1SDCZM263ipw1ktF1en3D/1Ug5itl7GsNDNeO8DPxSKy2lyI8f98tfv4NDxHOOCtGxlBqaiSTdevGQjJk5cAfqRNgXSgrVEQGFekQzZMBmuaMJBn5DQffjRj7iEQU+0aOMpSghE67Ze8PSLQty+fPz6QTb79hSrD0ATN3ZZE34G4qNP5qOs1HwnPXFMeKQKSactUcgs7okiSARmzIk2iaKd9+ka6eKjvF9czpGzCOQW1mu5ul4OTM8sxx9fHYEHH/dH0OitOHPJgWEjl0rc8NAldtZuSJaMPld7Ue0NnH/197Jt3JrQzvS7Gl/RJ3r3ivnPP+erHQcqSB33tOPsxQJsjUvHhrgM/OGvgv/7T6h15Fytx+tvD9IgqKhPa9IvJl4TYZwST6xIOHRRO6aV1fCRsU8ODp84TzD3mI4hcKBdCy4MrHb+dDlwxx1eaMk2dK4l0dpfrH0wmrv5oHnLAIkRQ9C0NWFnGJq3CBD62keHOp06iG4s8UpOEXwHh7vmotHKTU7B5xb5kgkTo8wPP8CMSNM2DNzatLHs7nvex/pNJxVSKgSP120uRIfO0/Dcn30QOGKNxsr84nKNLdwffugzDfL8Dsacr9qaMHhR3KoGSkyFwdzUjsWrE/DoQx7a3eG0c5CjXgXrFzgbr7w5FENGxQi/z5Akpkqgx4GJU7bh3gc7mRskRtN/9XuZsFi0S23d1v0o53AyqE9av2mMZQCbMllYCtsPCQ/6QReLoCzk++fNP4w7f8llyXzQtE2gxoWmbn6y+4vli1JaDJPXgnDbzwZg3sKjItRavaV6C0kDG3uBhANpKL1OaGRmyzt3mI5qUfjEiEU4dTrHfCsvildGT0GtNgZ7es/DX/4aIF5DldTjyac88dQzQ5B0rhibtp5CUUmpwFilGR6Vj77xejCChy1V7zNj0/+8NaF01RIVCmACkJyejOKe+zuJtRYphGinm8PMcHlFLuLpF/pgT8I1nEq5rt5Fa/vdc+7IvcYRK150vUmWWLhi9GioEyzdiznzN5nRLTqFJE5MZiqF4wYETVY2wQtnqs9/xgRVEsrvGY+Itf09V+BHwvGbczXdVsEq9CbiBU1acYKHr+QqszF9TopWWykMh/L4KvG6BlX0oMBwJJ8v1toWM2d6GHfGh9hNxw3c6pfyf8xbjLcSTkLGrERWNmtgvCeoZ+yQAD/AcyrWxZzXvEA9Ts51KaNQvKC7Hmdw5p+3JjqYrN4mVkEApDLkwqi1P706HAXXDEzQIo8lX0Ch4CH76lesPYl3OvlKYKtU7CwQmjfIZ6leJEvHGvWpTI7tOtm3w8DkJRdfpTBmStyENAe2xZ3A+ElLRTGsNzHpI2yoj8CIwrSdaB1GXiss5k/ZHpB40A/NWwn+txxshK+zZoj/HhKoe2OSJGDnztVpEsUzWRtYMKvD4ZNp8AmYJQphDGJNybzPWFFS5kROXq0cZ2bIaOxSVDBx5PCRy4iJPSMG59Bi4979p/CXV/sjaPhyrIg+g/g9WcaIHDQWC/pKRs/yhUkX/3lrwtdNn7yruuhk5wAHnStx6ES2PC/Vq2OAXLxiL7wDp6HjR4FCwdw1oFGz9IDpM7Yir7BSWZJCh7l6mOq8TeNCcQlPb+o2ZrGmOtSI9W/elKZDg6YzzgRrjTn6efMNhvfzDd6dGZYskBxjbMQOtG7jgRYtfSUOhAgUDRMvGICWbYSKthyqSvn53b3h47tGxx5IFOrF0IpLHEg6k6Vw04j5nHvA/GSQXxgSk9P0WM3PFK6M8gk+f3xlgP6OPcvTNjG4oCHReOHF0fhQ8pSFi84IerBkwoZi6Ejchk0XzVBQ4019aTMKaBSjPOewHmsyK6KTdSGlBlToPTP6r998Al4BU3UcOPliNa6X1WgBjK2I3T+dYJI0/Q4KyTzyTyLtug37lLqSf+uL/C652ZNJ6Sgr41gAj+IJ+Gg2A0RGPI2sRCHT1SJISOSvJ3X5ZBZuuVUoqFuQxIMhooggEb4oohmD9RC0bOclyVl/dOw4Dbt25ahg6uRifXzDdVhTBUvPo5gc9biUXoSZ89bplXBOAeOkKkBlVYvf/aEXdu/J1eFRGsaEKSuxc38e/Iavw213vIHqGhqziTmEwb79Z2v7/L9UgAl4rKXwJfOzUL99tKcKvRHH+dE9h87is35hWLhyrwTTS2K95viNouEXXu6vTMhkpfqynpfedfhQpgS4ZYqbRjcm8B5ISMMs/hy5wFWt5ctBit9Hp/2cj7h2fsqlIL5AP5drq6mt1u/2H7IOd9w5EC3a+qJFOwblYIkTQ0QRwo5aiDe08NcJem91CEdWLnD6XAEGDAzTkrJ24DHWyfMacccZczYonjNp1EDsaLwqO0aOicLzL7iLcFnGkzxh3QH0HRCNC9nQec+c4MfPqELl/dt/8TckCXP8agWo6/MwA5SsNqYJXbvtFx3BPhztZ3VwBWZJu8fPQ+i4LejcZRxee9fXxdUd8Bm0Gp26jFEhUD4qGxUc3daO+XP24GJaGcgcjA7IvOrh7TUH51Kvq1Vx0EM/qFujArg3hmN2uel9iZB4rVbDretdL4qlsHSwOyEXt9wuVLXFQJ1h6dY0UAI1YYn0VXKJVsPRpp0kcp1n4HqFE/6BEvwd7HSwmHFdAqac50pOPa4Vs8/IRGSjACPwNWsv4b67B5gZNvL3mfR0vNFhHIJDY7F8/VFkZl0TeKK5lMk12XHPA28henPiVyvA4K7r3hkYG7gmcwLu++2Hxu35jpOJC4TancLSlacQn5CBY0kZWlyjkn7zeE9Jz7ca61ZST+FblLWQAYwcNUMyXHlNsxyr5gAcbM+SPINBl15C3DSbEbcKngbBr1f8J2My8YMpPllX0Mg1eOp3frheaqqo2oDlZJkDSM8SHv6EJGy39hLhB0pgHi7CF+raiozJV2jsQBw/U6Fljfz8GoUlcwVWvQ9e+579KcqMXJcEU30149iP/66zeggvrbCkBh91D8cH3YLx0muf4fylAmWRzP5totU//cUT/kFrVb7/uDVpjM9G1qytODB99iY89FR3lwL4zWQnwJ13d8avf9sFv3n0PXzymXiAjaVdJ+5+oDPWbjxtaIReIh/ZZ2xa1eNZh2GUpQmLq/OmTqdmqaBM5ml+K8YcwN21USj69Sye1RtKKa/R0tOyrGh9U1e0aN1LYGSlsDASBQY/cnrWioQGZjvwzkeT0ba9UNTmgS4P4CPnEQ9C0Ki1qoC4uOPqveabGz5XQPS6vV/ENVWQUQCHPrv2GiWw6dRjrwnDGDMhBsdS8pBTXI/SKiqUcwro6Xa8/8FooalL/4UCPhcyHw0LCRkXg0ef62W+TimjKUs88JA77ryvJ579gz/8gqcIA2BBy4Hb73wDJ5IF/JTzs/ZjkhfS0zPnclTgqkz5mz07mTnFeP2tHp+zDP5mQGPp+3MM0+N5XbxlBjTj/pxtf/Mtn0lG7I5mrcWamwj7aeOHljf1Q+KpYs0TtIXcThgzY9aD/Lagddv+qgCTL0g8EIb0yDPByCoE3uzQV2ICa10G7nixHADy8A4TtuQSmj6YKMSi2+RZm7S41yD3UyZWxjUqsgoduuzm1BmrUFVN1kN5OHWY9ePuEf9CATRMClnVb1G3CRm3AU883/dzoakCZB8Vvh1b9xYhVpjEgcQMlRXr6Lf/4nWknCedoELq9AP8+VnW7/cfStFRL9f1qzyj125H+MTFejM8N39gx2C9y3tcwnfqEvNkH+I1Qm+virD8BsegJbk+Z7qrMEfpY9M2nrj3/j6YOHm7UlSO4fLkVolfRxJr8bNf9Jd8YYgKvonCUAB++YAfUtLkvkLnI2Zjglor2ZAGUHkY6DkWp5Lz0djebjgZM2tgSdRB8ztldgOzW3aexl/f7oXXOvTBoWNnNdk0uYsdfv4L8XG3CHOeL20M+qoAZYYqDfa72zFnQTzuf+yTLxTAG5K966eT8dmAGfDyW4bQiUtNyi1f9FNRwAmxPtY7tEuMCpDsk7QzcvpytVzDJvifU254GoquG5Zjtka62Sh8PpJ7c0zWULkDx4qE2/dEqzaSeLXm8gQMtEFmV6EORTM3YT3NB6FDh6lIvWCTzxECGnDhcgPu+XVfyZhHyPGyt2RA9sb9D/njQqZNk6/RIXPAXgoVkYML/gl5WLgTEZNjVDGNU1QpRCZ2C5cnqAc4GkwleNGybThwKAdJ52qxIfaQiUmETjljl26h6Dtw7t8pgM/t8h1NOLpPYzF4b/hrjKTjd9//vnnNtbOEu+9wLnYfzMTyNccxa/FW1T5L1lTAQXlPlemCEFYZaSGDBo9T7+FCS3ydvDk0bJbw70Z7oob5n4tyupTOk2sVU063aetV/ObhEbrEWJNmZDciQDeWIIbquhJNmgVIkB0lf4sCWgxRD3ngt6bDjXEmZnMm2t3yqXxmpNJRsxxaAJ57QTL9UicqKh0YF7YIbJkx328eYzacQsCQBUYBjWyIQV7OO3FajAqevUmscYVNnI++/Saiz4DZGDx4KipZ7zI2hzfeGgwf/+X/pAD1gJLKakyfGYOiUlP7Zg0jU1LMn9/9jtEghUaByntTIqNw8VI1Dh3NwbGTl7XkQB0/8lhvREzZoDSOVUyH3WTVlzNq8Vmv4aZx1iVoFunGjZ/jamrl1qgYXpCBQsVOeXI5S2hiUKwE2n5oLklWM11RlxZvaGVTt8Fi8WLRzSUBYynCjUGWfJ/rxHmhvSRng4esxR2/NOWJpi2YKVNZXmjWfBjCwrdo8K2vd2DhgljwblgGMQkhsP9ApjbzKpKzIqkI6UBlrVNorJ9CrDaN2Q2J0L4oypCKBJt5OapmxUOPdMXs+QeNLOUUZE8pKblCHErQpFo+6em3AG906q+1fLp7jQTQ517wUWVwfq6GRvlwTXUF6sXvOJjO9xxyJFP3v7wySjQ8x7ymPyNuRtKSkyrRt+94MzVJ1a6GLW49z8yIUUtn6YHqcag72yy0fJveyJvvRIgQPdXCW0qGS0Eb4fvoDzQ0E09o0XKEYDsTrSFo3nqUSbgUogYpPLWUAN20JX95Wzyl6Ug0p4LceqNFq2CcO1/iumaBkCUbldMrkSMhkMf9CVcw0J0KMJavT0SKOYUW/ObBd80AjdoVM+VqlwHyRqvA6rFV5Mjs5e57O2L/0UvqKfTIS5m1+KDzKBSX16EJ6yIBQ6chLdui/fxde3gjTwjNhs3FKLwmVpyXLa8FY9+B8xpUbA1mvQdeIEu6VFDiyQo887v+0LXbSJdoS3LMwYPZ8PCI+CIGUNDyOCZ8itJT1Yqm2vyMeWCFMinFKl41RBIoPx0LbtJkoHJ5ZrYUdnOx9rbtPRA2IR5Z+eKZM/bhx7f30PGBJm6+X4oNXKKGn/MxHtJiGJoxBjTrj5/c4akQQo/k/Sxcsl4HDVUBSgAc2LTlFHwHT/tSDDAQOmnqdjz4IKucFC9914wr8D02ntUIUzuTnIfFK+JQKid9/e1w/XnFcZLIdu4yEMWStwQNXSDw6kQT0shtu47qD90wucm7VofRYYsROeMQYjdlo0o0Pnv+dqFWq5GZUaQ/H0WBUsCmu4HLAciXvDFUmIqpLDZS1+TTReg3IEyPNwHWqYnJmPFTtb3R4C2FT/ZlqqDk3X/80wSxXLFigRguYdmcAy0iPMPf/YSGeuDDj+ZqHYdWeK3EjjXrU9BCF+x2KYADNGQ9bgzQ4gWtuRymvO42HK3aeuDFV0ar4Hn99NAFS9aqp5u4x8KcVYLwNkyIWK2B3DSBmWUBP+0Via6f0DPIcowHUwGMIWxPGT9+ueyrkHyxAIXVTkyYlIhFK/dg45YDmn0np1QICkTpGEMTXkW9sJesghKUVds1geF+vZIdZQNxQTxj8cp4TX42bzyDMWPm6rCMGcDmJbMtFdgZfwFbtrjq4eymkOOLS23o1SdYFcAbogXRwkLCZiMji8OO4kHscGZzldwE+ys7fTADzQkprYe4oESwv3mICG+4wMgAPPKkv9bgzUoo9CoOHgv9FeUnp9bhjXciFZo0HjDouonFcwEnnodKaOGP554Plful7dK2LSiXmxs7Yabek14kjUGE6+k9FidP5YC/a8z4xEUESTlf+atk32X0HrPcMQd0WCo5f+k6fPymoFY0eupcOsrk9YBhsdgen6aMkJyuRmQzeeoK1FhMfG3CO+Hof538VVTKOjgDSb3cpAN3/uptLFx5HEtW7Vd85KB5xORFWn5RXNehMlqFQ9JxC9zdF6pb8x5IbdmDOThwvAuCeKzByBmz1whVOynWzsAvsOasUnx091kqDOYTwXrSRF/DdgT/mwv0NGk+GK++MRbp2exiI0WloGjCVICarTKmi0I53Vr1lsQrEC3bDnd5QKCL+3OxKHfMnJ2oBsVlFaxCl69X2TE8dIp6pJbleb3yz90zFIXFHM8wQ3i8Z06Xmjh5g0CNgR6NFw4abSVCxszD3gMpggR2nD6fjQtZdjEYD1c3iemgLq6o1GFPBV1VQAPnWzm0BP1JNz9UV1NIEr0tdbiUVYWHH++OS1c46sVhPDuqJAvZuT9D20IoA+6EFcb9z3rNwOtvBnyuAM423LLjkBxLC7VojyVrbjlXqwWy+qiVcVCDgSl202VwqLFJUw8R4HA0bR4sUEG890Grm3qhV9+5ahymOKaS0i/X8oCRnJzfItZowfk0K557UQTfnMyHimQCxlK1L9rd3N00Djew+mt8eHjYXKzflGDuh+zFSYE6sGjpFh3bdaBCr5u0+vU3g7UHlDUwLjLOySD0RrajJCblKKzxb3rIn18NwtKoPeAIn8NiRtD27D3jGrK1K4w34bdxwhsV8Npf+yD9UqVcGFkMC2bA0hUnxEKqdcon8Y/2MW1unMKWDrjbzMXUyt9bd2Tinns+1LV+aBUWOeDI8Qs6GkbBEZZYwOOaod6DwlUprAUlpRTg0cf6iwJE8K0JOaPQvKnATjNPUUBf9PfaiqsSuUjz7Lw7LQopUoCJH4sU6hEUIJczEMWfS3PocmhkQF9WQMcP5ul9sO+Hx5Ntvd6xL3IKVNKqAMIkZ3zG7T5laCXK1KBmztmAp5/xME1a/H5NzEzrTm5hHQpNNUZbOtmS8vY745FfUu+Sk1MHsLy9JmihjqTEKMDlcvzuhQu3InrNHvmCKpdxm4okDyAqqgLkjR49hyEoZK5kg3vw2psDJUhvlOx2jmo2K6tWu4zZqkdLKi+z49iRNH1PQ5gol8G2sLhYm27LBdba39pXuL47dPG9Vmw/ESW0GoI27Qbig4/mKN9WFkilE/JcnQ48P9HH5CkSDnV2POOTGQzZsz8Xv35IIKy5L1pLAA8Lj1f2xWP4g3Gm5dKBU8k5KmjiuN61nLC4rAIFhYRHJoNWFd4fXxqKy7m1yC+qFQY2XTx+PPp5TMCgoWPRpcdo8xv2DNb6j8rgdTK/MUnXidO5kpQNFDgiXlDCFirAMBYKOykpGzNnrTUDFK4k6wsF8BjCEH/8YB02xSUJXbWik9Aqjnlu33UE2TlV2kP6gHDkQ8fMkB6HMkNHLdfBG/qB9tSLiVVKJE3PKUduMUT4/SVwGt6uVNO1gPefXwvH5WwTuClw9oXSDOhR9SJhCoV4Wi9v1lg59sC74CA7B+HN7wSs3HABbdv2RzsJ4PnXCIu8lzoJXRZlUFfza1BZxU8aI+NGT4vZuFfbcfgKv+/gwRzE778KCWsIHjEJ6zbHYfmqFKzbdBaX80vh6Ttb4UwlybhAZqSPDtMEJo/bdibBz3+qQrZZjdFKBRgLIkSQwUyMWKIuUmNlgcwMiLjcQfGOpYoaoVYDPcLUavhjmteum1rRqqjdGDVyEc6mWfDE0+4oqzU9wdFr9mLPnvNyI2xPqdXzs1aSnu1A74HLJFASIkgzh+tOZbRq10cbnNgKYy7BzDdmkHf3HoEp05cIdKUL7qYiciYX656OI0czUFzMBl3GBTOPplQkPml6NLbEnVBrVupJqcrjtviTCB42y2j3c57vEKVYMGH8Gr173te0KQl4+LddUS2YP2rMArkuKyobqvGpMLyCsiqB3pOYPmup5kR6LqpNBWzGkhsVEha+WCcG0ggbGaQqwHgA4cWJnTsTFaONPdlc7IUH8KqJnQ3aPjJXYIftG8wdFizaoc85dzbAf5ZS2MjZG7H/UK4OtqdLtvTee170NTBrJBMqKq7X33985fXxSjFV+Lp8Pcd0fXH7L9xVeVZXSzsVwJpV4vF0XL5SphBnaWBruXiDnLBEssrJUxZh2LAILFoci/UbEjBr7ma4e0VI0GQApH2bXk0WwZi1eg4eo8J2anAxbsaYsnrtXmzbfkJXAeD9PfX4QKyPScKO+GOImLJSgymD84FDZwTrHfAX6z8vrIclcDVWVQCruF80GfCeJ05aol5pIIrKaXCNCWuSYcoBdMuw8Yt0jTfiqjbW6kWzJct4C1XBwfD4hLNiFQ3IvHodw0fNUNyttdXCN3CcdsC98oo/Pvp4jI6MVtQ6kJlZp6NhLHfsPZiMs5dr8KvfeIkCWJ8PMIuvth4kChiM+x4MNDkJBz2M7rFk0UZs23bU/MStWFXj70LqCupOJnmmeEfFEc1Xrd+HtWuOfc469D7l2LIKG4YMmWHooJzLJq5Pg2XjcKVI6MDhVPUWjrR5eMxBWk6ewtHRxEz9jqSTl9Hz02A1WC4wFbftJGM/dDycCiD8UN1kfw7Thr9TlFdVQwOwGVt20VfXgIxhBEYBFoyPWIy1Gw5+XpxjwYk7GUvjaBMnPPgETEauZM4UyKYtx/WGbKiWGLEc69cfw+GjBXju9/1RVsMGJif69B0tTKFWa07rN++TJK8WDz7qbxqrtK+HXQxsL/HHbT/zVf6sJYwG3hwwYeIipXfVDRz8LsepM2k4fSZbsvdKs1YFFeMwOM+MdID3UFwrFgrJETe21FM5co1DgiOxZesZk0A52Q9lyAYFlXQmU62egh41cj2eeWoAKm01WBl1WOObRc4zctQkpF4wgTtJvr+krFphlRM5KE8lCcR++pv8Tdo6fNR08VjSELJMWrLZXc25Bv/UNenqdqb3DRgbvgC74lNw7EQ69iakIHj4bAQNn4EhoyYgcHgkgkfOl8xzMGYu2IS5C7cjJ7fOsJ0GTqzLQEZWmc5UefLJflgbc1ani46dsEAVsudQCsrkhvp6rBaqGSiUkTUbDq4EqUKat/DDuIgtKCoz84MlAsBrcAgGB0/HroR8nDhnwZpNF7B8zRnsO1qDgyeL4RsUgZFjZsl1hgnezjRLzagBcYRLcpKtR+HrZ+Ync9I2b9Rp4yC8mVobHr5aZ00yk920PQmzJWHjAq/BQ2cjO7dSE0Cr5ATT52zE7gNn0PmTEdqQNXnmaowMm4fpszcIfB3EmfP5yCmsRlZeBQ4nXkSUMEuyLxoxRwobhU9lfWV3tFmpyoFE0e7KdYcFz2MxZ+lOjAiNloxXqKOFv1Qk3LegFheulGPXgXQcPpGrdRziND2Fs+XHjJ2hx3GU6sGHeyjlzL1Wi007TuvnWKjasb9IslMvNGvBOg/r9ZILaI9ngLYf9nVfpnSVMzLnLY1BUmopgkfF4dk/hOiAe5vb+uGOe73xzscTcKXAgYyr9UIhy3R1K+0PcBqmlJtXhcgZUcjOr9XwR4USZxrqycrsAjcWrFh+VOeWnbt0FU+/0FvnDOcXyjVuP4ZaLkClE1PqBdr2Y8SYxZg6a7vOnTiXXiZ7OZLOV2PTziwEhyxGzwEh8BgUJmQhShNNHVv+iu0rFfD55jA3wDqLxV4jFl6GgQOHqkVabKzhMLhxMr9LqaSYFrPCoE0iNfFx+cr9upRBgVjSr+7vigMJF5BXYEfvPqMRsylZkjzg0We8JWvtBvZ1mgW7AwWGRmuTVdMWA9Hm5h6465cD0bnrGrRp31te47rT/q4inb/QWGa9nI7EWY8TtGzCGFFe1YA16/YLSzkqnsiftuI1E3uJPUzg7AKHDolTXpJ0HWMKJkqswl/fGoKM/DpECrMJGj4WXDBK+1W5k9Oz9mQzYxeNcFMnUt66bT+GBI0z2bCd8MYCIz/HY79aA1+vAHIwO08i9FGUQPaTKPz+wvlCsXTTqkKMI08meGldyFovF8fEw4yVXiuzYcHynSisEAU88BFmztiodDe/oA4vvtgL+w5mYsvuDDz9fLBZ4VwzV9eIF2v9ragEL22ocmvjymxF6E3oMbpquq8cy+FJ8SI3d9zUvp/GiMRT6RgXvgQzZsQo89DZ+xwsokDsxH0LigXst+48hRMSVGsF0Ek8IqZtwIUMoEw8N0RgjB0OpvBIJXDMmDKBwgcnljC+0OPZ1T0seBKu5l5X2NNmAxfM8Am7+b5q+1oFOBwSPTgXzG4KXY0B7tTpdIwIWYjodYmIi7+EuD0piBa3nD9vBxbOi5d9AxbOj8OyFQexbNU+zFuyH+91mo7J02MkWFZqcOdF00PWrjso2BkjQdWGwKGxuPuXEoTdhooHSF7QmkIONH3/unQ9l5wfZII1K6Y6FjxEkzcONzYX9uQmijp0vBwLlxxS5gPX7BQdLHGaJC7/mgWr5XujxDuYIFpN+7IKLv+aHR06BWGA1xxculKHC5dqkXBYKKjQ0jXRh7Ah5oTAYCou5+WhsKoeWcXVmL4gBiPGLlASwEZkLtNsSt2kzxwZM6T+q7avVwBPKNc2fuJiXEgrxzVJeWvEcsh6OIP9b+8OxNiIFYiYuQgr1m5EemYRcgVjCwpLkZaRie17DmFlzDask+B36HiRUFcSxmpzcWQd8oRTkcInzEePXoNwXbzkYGIp2rbvjxa0bv6egP6qNuMDA3RjRwNZE8vVpK0+4hUcJePImK8EdE/E7buMg0fzNBlT4YvrsnDGDD9fssY3OvTBjDk71BM5+1FNVTP/ep02tXbjCXj4zUS3nsHo2sMfY8dP059BWbR0IxYs3oBe7qPxl7f64sXX3PHS696Ytmgbrouea+Qc/AW/3PwqUVqKooOZBcSBqH+Urtm+VgGcymMRhsAFMnx8J6FcMuDSShumC4x07T0az/2xN373wmfYsOUgjienStQvlMBchtzCWuQIzmdJwD2eUoRX3xiA6fOWIPeqTViNQ2vjRDebjVDgMLU1+Xv/gXN49/1+uCSMI1uy67t+PRA3/8QLbq04MMOuNnnk4AoVoL2ezB848DJIg3bTlt5waz0QOaWlOHoi03iZ7IXFNdgucSA6ag8qK1ywKZZpETLBGKf5g+zawV1mR+LpHPTxGYeYbadwtdguNNeJvOsW5BRVIbuwEpfk4pIv5mPg4Ei81sEXf3nNS2JaGFLO5SlrW7/hGCZGrDK5XaMwv9oB/o0CHBwrsGjP/+JlscqBlYo1cNTThlxRe3p2jWS8F7Bx8yFERR3EimVHMHt+DCIj92JC5DaETdysBayEIxcwfepWoa5zER0Th/OXMzRA6e8BKB83dLOwuA6h4aswImw5Tl2sxewlZ3T4kT/G1qy1hwRfTxE0C3YsXxCGCEGigOYj9b077vHlynSInLlGyxZnr5RilMBDTOxRTdo0cRMv1gEWQoWdg0+c+5CpP/4zfPR8rNl4BCdSyxEgtDtk3GrZlyFMl0fehgVLDmD1muMCuYdx/Fym5DLFKh+l3+JhRAf/oInIyCw3AV9nxrCc8i1igMYPmKYqJhojRk5CZbVDLWbnnpNwHzQRE6bGYPy09RgXuRrBoXMQNHIWAkYsRvDohZg4bRVmL9yEg8dzcFaoWqlQOS4bw3aRLPGSvYlnELUxHoP8J+uaPKy389wsBXPB75OnszB/6XbMX34ASZckkfNchfY/6YEWbQR6mhN6yIIoeF+0ummgKPYiBP0w0GuKeOcnSBAOnl8oDI7jFVS24HOdCP/I0UsYN2650OtV2Lr7JC5mVWrLPfMTluA5Hy0tpx7b4s9j/rI9GB2+AsNCFsFPchDu/kOnIXDEdISMX4oxE1YIhC7CtevVSkyYN1VUmYqCKe5R8BrFv3L7NwowZVX+nx4UMWmhJCoJmqazFuIzeBrmL5LAtC1duHGSXuyMedsxYfYOhE3biMDRi+HuNwudu4fhg+4jMcBvHMaNX4E1Gw5h+94kHD+bhbTcCpy9UILpszZgytRV2J9wTus2xE5SSWaloSKAwJEzkJJWh/iDJfjVbwYLNR2AJs38BJ5G4ubb+uLlv45GgeQoRxJz4eU9U5LHq4LJwtw4TquJFiSgFmDLtsNCFacrTBQU2XA+rRT7j1zC1j1JmLdsu8S0aHzSewI6dh+NLv0mo5cE45HjN2HCtDhMn79LjGEf1sQmYuPWVE0uhwTPRcG1avWAHGFA3j4h+pzf94UCVIhfuX2tAho/xRMxkrMjbP++s5IdmuyRsxnrxapGh81G6PjF+pPkQr11dEwHLZiUqcsT74ED+85jUuQShE/cgOWrRQAVNv0ZqsDgWZgcuRYllRZVbGCgZLu7UkxCxx9b43qgzipkZNQgNGQ1tsRd1N+Sf/P9YWLpwTh/pRJLhHEdOJisQVVL1xxzBScW1iIzswYTJ67SNeLYO7o8er9krjORcrZEfxorLv6cZPI74T9sPqbO3Yj8Us5XMHHBItDB+W2cX0YUYHl9adQR+PrPQU2NK9OWfyxGjglbrAkbsd+i7TkU/ldDT+P2bxRA4RPHTKMUT8yJ1KtWxWlqTy3ztWoLp7ReQz+P4biYUaU000R9lq/rtFeIECgpgo4dXC2ux/mMMrz/URAOHMlDWTWQkV0N78EhGsALiqwCd5GalZrxiAatn1AAZE1zF+xGr/7hyJQs9WKOHV2EqSSezNamWRbUHJy5IvFKlS+f8/IZhT37k3Uwf/eBs2LxmRK/qrSTeeqcaKzbdAiXcypQVmtWgiRc0eV1Fj4H5AXDOXOTXdErV+zCDqHd7AThuAYHiXi/V7LLkZPHiexUCJXfaP18/Nfb1yqAN2/q2TBMzcVnz5+7Bk/3ENU+53hxfFW1bjU/UejlGwGvQRG6pBeLYixJs3rqNXgyPvnMD50+8kWnLj4IHDUWc5euwYdd/ZB6qUqD2bm0AlwW8yZTCg6ajLoaXggDXJVJ6e3MqisFn08JA/PDw4/5YuKUGOzed0mtUNvMaRiEsQZOKL+q/U0sX8+Yt0Yz71IxggkCd7E7UzF5zmp4+A8R5Y+Ap+cEDBs6DydPZWrSxnPxOjZuPYZX3uyBtLwqXeRJ1AT9wTcK28EJG7skSM9QdvXlgRiDIP8Ce1zb1ypAS6Z6QqMMjuGSW1PQ0dEH5KZYGzGTtxuUUTi1BHu9vhb7jpzH2AlrJAhvR0p6iWD+Fdx1X1dhErG4kHlVgnIGEo5eEM59EMNGL8GgwfMRu/2QrjU6euxC7T4ICJyEvDzOqmQAtaLgehlWRu/EuInr4OkXieCQaPT3jBLOPgkegyIRMTUaMWLNynYovDqu6TYblVabKOygLqSRJqwtZOxGfCo4v2BZAmK3nUFiUhaSUvIQuyUFb3cIlHOcl8BchJ37zwqTi8KSqHj5XIXymVolJSxiVBqaLkofEjhblExPIa11lSzUdf/99vUKoPtQka7njSM7tA7Cz0hhPMeOZOvNsvjKmjwpau5VC9bHHMb0mbGSbR6WrNGKw8n5GBq2BKPCl2Lu4h1YFrUPK6L3YM7CWIRMWIDo2EMokTwjOTVHhDMG7t4ROHwyHWMnztHS96r1J4XSrhYaGKcLwebmW3EyJVOEasWZi3m6wu3eQ5cwZ94uBA9dJnEiWajkFUSIwneKd3R4LwAxmxORU2hF0rkSgZ5NGC/xaNaCaCxZGSsxIAYjxy3F8PBl2HssDxcvs6n3BKbPicHK1btxRZiSxiQrvd2s13Kt3Cbxb6aJd7JrmdnAhoHOv9v+6QXd/o0CvnqjIpgfpF2uQKdOfjoSxhJuhiQou/em4oOP/DB+UhSK5fXLBTb08AhFx25DkZzmRNKFGmzcdgzLVm8XNrRPrE+84ZIFEdO2YM+h06IEO7bGJeH9zj6S8FjQ3zcMqzYfQG/PSKxYs1choUwwZOmSKMM27FyYdb1w+WotBbBbbtqM7ejUNQgxQglXbkwUGrkEvfqN16pqfokFH3ULxaqY0ziTVqz8f8OWBKHVyaLIKpw8X4fP3Kegr3uofH+1LnUTMX0N3n6/v/7wT2bOdVSJ2bMNJWT8PLmmncoKbbqO0T9K6t9v30oB1PbW3afR1zMcvd3HYYlYyMnUXP1BhvyyesxZfRC9/KZh3fY0zFi0F37Dp2Db3uPagcbhQ7a4sBmMGMvB9BMpGXD3YQsHMH7KVpTIcdyDRqzEB5+EYcb8/VixdofpLhMhHjqYqKyK61UzzNECk8+ZVVGUvlIpApG/eexTzF2yVzJ0u7aJ9BswUmLCNfgFTdP6DWMOz8cJF/rrS/Kc49C7DqUiKHQeps7fgY07L6K3VwQiZm1EXqkp0iWfLcDi5fGipDD0GRiOmTO368+u2J21/yiqf7t9KwUw8JwVXN+VkIY8jg+I6ZWLGYwInYsuwp9XbrqEyfMSMGH6dmyNv4TCcqcyEB1i5LoLyvFNG6QuUyw3dlpygUMnS3ClANgUn4hyiSfd+4zD3b/qgtHjl0lsMKtq1QvGZWezGmsEz1UZKUQ+r7HwzKYlhWuSjhi7Cc+/7K0EIFfOe+TkZVwtcmDl2hPIEU9gb5MOmzu13Ut3Wjan6XIhv12H0jBtvuQGk7Zi/ZbL+KDrSASNWozLWaU6qpdfzIVLqrFoabzJhh3fkwLoaeRDrBF5+zA7NgJo7FrgPK4yCXjnz+fgyJEUbNi4D0tXxCF07BphNrFw95yLDz4OQ3/vuVgUdRD7T6RhRcwhjJ+6WSz2iLx2FJ5DJomX5SNk3A7NoE0Xs1O9b8XKLVgVHYdN2w5hyswlWL5SEr8Jc1URLAew1EBl+QTOxAc9pmLQ8PkYOnaVZN3JmLf0BFZuSEHcwWxEr0+Ff9AygZdhEsxnwsNnJgYFzEbElPWYP38Ptu9IxcFDWcjOtaC41I5qW52EWRoQf5rRqUObS1bECh+qgnaGfx4v//+3b6UAqoBLEpCX5+ZWYUzIQpxNuaY0sZ49ORzkFkGR+5ORcL1niwRuzkVgQJ2/9CgGei/E0TOlWLzmELyHLEbA8NUYFbYG/sFRwopisedwKd7pFC7B+rzW93lznNBw6MgpbN1xTISfiEOJlyVIL0Ba5jX8v+au7SfqKwj/P/WlfWjaxsRGY1OrD62tbWpiUfGONRoJahHQBfGG3G9FRBYEBFlYysVFYIGiREAXFblKRRSBclMQEJDL1/nmLCb2wQSExJP8HmB3f/vbM3Nmvm9mzpzT55NQ6ryPpuYnpIGiDNNiZuzwPJiAnJJ28SP1OOyXCm+/FCFcqTh07E+ExdyQVfcSXjLplpBMiPXECE2b2HOuNLbpZMCQ5o6Cp7kjq+4dGkJewS04y1s0Wc95fyfwtoCxSAEYj8+A1sTkBEYFgPeJYzziewERMZlCzMgeCQVNCeA0S0em2BTpGvyD4pBTcB9eh6JhOZsFH784dPZOKEEjCx6ZZMPVZOySVcJTVBNEY7mwOzqHDFOW+5wIjtaDma3pTiFFjejofoXH3SP6ndw+dMNRrUmYvJI78D1jx8YtJ7FPYO7T/kn1U0xRdgvhswiqOhJwWQSQiDhRipDIXBw5HmF2yJNEEs3Qr8ywZoqdtVoQYLmIu64ezWVoicus6Qqj5IMlPAscixYA7ZBJeBvHxy7ovYPTyM2vg+VMIu439SpUZVk6D0Z40jGKK1eqhXFOwHIqV5BLA3IEDfW/mjShi1nTDqZnqA+ee84gMbUSiWnlSMms0wM7nZX3NBnEaGOCNVu0Nx3OqlaUC/SMTcwXCCnMeY69Q2eRe60CrwQNpWT9De8T6firpAPbdofi0dMeQ9bcGk2HWl3fLmSsQGx9KR40TwpjbkdJ6T3VbGPyZrSt8fUiF04Jmrp7v0uLjUnGWGnBQjVOxJypUV/wWLwA3jNYrDQovD3eWgCP3UEIj81TJ7hmzV5ciCzDjn1hyMh2IUSIU9DpRPj5hyMqOg1NLb0YGmb08rU41ynU1D/BAZ9wRIojfNjc5Y4pEdHMwtXQhoKiKpSJw77urMIwvSKVQuz06PgYwmOs8DrMQKCBn3T6o2L/WgUFhUVm4Jh/FM6cS0VoZBZshY16hGFs0h2s//kInr2cge36TWze6g9/yxXhHAzJmxqpaTqXJRzLIgBu3ZmQpekfeAm7vSL0gAcGwYICryAk7BoSLjmQZC1FadlDcdT/YmBQXNs4C3dnFU+/fiOrRlCVt284vlq9U4RgRcs/AxoM5Koj7mZIu1Bwec3dx+gTRMOaHfZyY9Zr+PWErKB8RMRWYf2GALwYI28x0RlerNTo7xPkJSCiuNQljrlIN177+IkvEnLZ1t2HYZH2H37p2H8gVlenHl/CahHeYAnHsghgmk10ZtgShhsmunAqOAO1dd0aTuDy145ZZM5EDjBxJJoyZskGhdIGWjKwcuV2jM6a6unL6TUIjshFY0sfbDYH0tOzcbuOZYEGOg72TsJZdgfZdidu1bWj9cmcOPRs0d4sDaCtWbsf23aeRdfAmG5EMY0/RvTDTFfS2M+HbggaukQAtvxyZGSVK7Hjk1Kwpsp54Xb+fWNZBAA9Y8xECUm2Gps7ERqegpSUEjx/PiwOzSRHtNx9zmzQYKVzkrz+23Zf5OY1aU3nJNsdyLt++OkoQi9Wald2sS6yWkR0E7y/0elZhgdmeKITFJ8Hn89Bdt4D9A8T348J674Jv8BM/Cr3DonKVAeqzwb2b9ENV1rK+FJWRuOjfvyy5SBsOdVC/Ew1qSoIHbLGgab+/2M/aCyPANzaxMnhRj6j5SaeTgTS0SmU39WF4pImlFe2obl1QHE22wvzoObaez3qIMenTLCrsKge6zcdw4UoOyzByeIP+tWM0O+9ERrL9xBBBYnzDxEM//kXHmLq7Er+hkUqRD7syP7d97/j8bNxDMh3NT0cQK79HqzWClRUtKChoVu4i2lhSTPP9swsO9GjW9y/xay3pR3LIwA+LB+aWqP7uYTFak8eLmceA2XSmlwdJqdgqpKVzcqkHT+RipNiQiJi7DKpaVixYhPsgkIi4+wCQa04FmhFaHwhCovrUeSoRfLV24rp+RnfgBQ0PZrEmnX7dCVcSi4TZ28V+Bit1XH8Tq0PckNMVRbOq+5/mqEXV0fDOp75jSAahCT9mjN7KZZyLIsAmMDRdKYKwPzP7BwxGz50z5Qmqefdon4IDOcSaXCRszA3NbNWiVl17Tgaml+KLyjHyXNpsDnaEZtchTxHPfIdNQgUbb9qb8Eh73gkWovR0jmItqdv4OOfLmbNqQdHmOoTlivy4qwbE6iJ87eTyonmpPPZyGHcWvQOvlxaL7wsAljsmC9ioglgqnDdhv34cqUnVq7ywqq1uwQu1sPV/ELw+hjiBJoy9M24T+xlB+48GBJUMwjHjQf4+pvNWP3tDnz2pQc++fRHNLb2m2SJ2nCq+xKr8QeMj0oARhXf2gQ1XVwVFAyJDl+lw96wcS8etk1g78FIbN1zGk3tw/DwPKqJIk1DEq/zLnPmUvio2k0BmL0QS21KFjs+MgHwmhcC6zjJNBUrgl2zWbHNQ9wqbjbi8NEwZOW5UHqzEwGBUcKU63XyTeO9cdV0U6Fv9gZoqwG973zK8OOQwEclAPWJaircFx0g/fnsvHU2r6szlz9OWuIREWlzVyLzDrTPlIJbaLqSaPzn3ppxM+8UxtLCycWO/wAp8vANFcVKgQAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKoAAABeCAYAAACzdY+NAAADD0lEQVR4Xu3Yv4rUUBiG8bkY72Gvwcq9AdlKsNXCC5jGxmIruwWrtbK1E7EUK7ccwUatZLEVLI6bTDJz5j1JTL7vjOzHPj94m0D+FA8hZJWAAFZ6ALiNCBUhECpCIFSEQKgIgVARAqEiBEJFCISKEAgVIRAqQiBUhECoCIFQEQKhIgRCRQiEihAIdcrJiW1PjcMoQh2j8S2ZBrhkGESoSqOzTOOzDAcINafBWafRWYcdQs1pcNZpcNZhh1B7GptnGpxnaBFqT2PzTGPzDC1C7WlsnmlsnqFFqA0NzTuNzTsQaktD805D8w6E2tLQvNPQvAOhtk5Py9g809A8e/FQn/ZOItSexuaZxuYZWoTa09g809g8Q4tQe+t1GZx1Gpt1r9f6lHcWoeY0OOs0OOuwQ6hKo7NMg7MMBwh1iIa3dBrd0qFAqFM0wLnT8OYOowh1js2mjHFqGuDUfmz0bhhAqBOeP7BtzOrt9DCOUAe8fFTGt2RKg5zaq296NhqEKjQ6y3Ia4tzhEKFmNDjrehrf0mGPUDManHUNjc4y7BFqR2PzrKHRWYctQu1obJ5pbJ5hi1BvXL0rY/NMY/MMW4SaytC809i8QyLUhobmnYbmHRKhNjQ07zQ075AItcE36u1HqB2NzTONzTNsEWpHY/OsocFZhy1CzWhw1jU0OMuwR6gZDc66noa3dNgjVKHRWZbT+OYOhwh1gIa3dEoj/NdQItQJGuDcDTn7XAapwzhCnen86kO6f3E5a3O8v07p1x89ijGEOuHepyemoT5CHaDhLR3qI1Sh0VmG+gg1o8FZh/oItfP993URnHWoj1A7GptnqI9QOxqbZ6iPUG88/nJRxOYZ6iPUVPdt2gz1EWoi1AgINRFqBISa6v6aaob6CLWjsVn35udHvTQqINSOBmcdjoNQMxqdZTgOQs1odEuH4yFUofHNHY6LUAc8+3pZhDg1HB+hTtAgdfh/CBUhECpCIFSEQKgIgVARAqEiBEJFCISKEAgVIRAqQiBUhECoCIFQEQKhIgRCRQiEihAIFSH8BeOSn9xk30qNAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,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>