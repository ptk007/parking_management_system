**1501418  |  PROJECT GUIDANCE** 

**FINAL PROJECT  •  STUDENT GUIDE** 

# **PROJECT GUIDANCE FOR STUDENTS** 

1501418 Selected Topics in Data Science and AI 

**Assessment:** Final Project 

**Project Weight:** 50% of the total course grade 

**Project Type:** Group project 

**Recommended Group Size:** 4-8 students 

_Problem  →  Data  →  Model  →  Decision  →  Action_ 

Page 1 

**1501418  |  PROJECT GUIDANCE** 

## **1. Project Overview** 

The final project requires students to apply concepts from data science, artificial intelligence, and decision modeling to a real-world problem. 

Each group must: 

1. Select and justify a real-world problem using an available dataset. 

2. Examine the dataset and design an appropriate data model. 

3. Propose a decision model that uses the data to support prediction, classification, 

   - recommendation, optimization, planning, or another practical decision. 

The project should demonstrate the complete relationship between: 

**Problem → Dataset → Data Model → Analytical/AI Model → Decision → Action** 

The proposed solution may use one or more approaches covered in the course: 

- Statistical analysis 

- Machine learning 

- Optimization 

- Generative AI 

- Large Language Models 

- Retrieval-Augmented Generation 

- Hybrid decision models 

## **2. Project Learning Outcomes** 

After completing the project, students should be able to: 

1. Identify a practical problem that can be addressed using data. 

2. Explain why the problem is important to relevant stakeholders. 

3. Select and evaluate an appropriate dataset. 

4. Design a data model to organize and manage the selected data. 

5. Select an appropriate statistical, AI, or optimization method. 

6. Translate model outputs into practical decisions. 

7. Define suitable evaluation measures and success criteria. 

8. Communicate the project clearly through a report, presentation, and demonstration. 

Page 2 

**1501418  |  PROJECT GUIDANCE** 

## **PART 1: PROBLEM IDENTIFICATION AND JUSTIFICATION** 

**Weight: 10 Marks** 

### **3.1 Select a Real-World Case** 

Each group must select a case from a real organization, industry, community, public service, or research area. 

Possible application areas include: 

- Agriculture and smart farming 

- Business and marketing 

- Finance and investment 

- Healthcare 

- Education 

- Logistics and transportation 

- Tourism 

- Public safety 

- Environmental monitoring 

- Disaster-risk management 

- Customer service 

- Human-resource management 

The case must have an identifiable dataset that can be accessed legally and ethically. 

### **3.2 Define the Problem** 

Clearly explain: 

- What is happening? 

- Who experiences the problem? 

- What decision currently needs to be made? 

- What limitations exist in the current process? 

- How could data or AI improve the decision? 

Use the following statement to define the decision problem: 

_The proposed model will help __________________ to decide, predict, recommend, classify, or optimize __________________ by using __________________ data._ 

Page 3 

**1501418  |  PROJECT GUIDANCE** 

#### **Example** 

_The proposed model will help durian growers decide when irrigation is required by using_ 

_soil-moisture, temperature, humidity, and weather data._ 

### **3.3 Justify the Problem** 

The justification should explain why the selected problem is worth solving. 

Support the explanation with evidence such as: 

- Statistics 

- Research findings 

- Industry or government reports 

- Organizational information 

- Stakeholder requirements 

- Economic impacts 

- Social or environmental impacts 

Students should not rely only on personal opinions. 

### **3.4 Identify Stakeholders** 

Identify the people or organizations involved in the problem. 

|**Stakeholder**|**Role in the problem**|**Information or decision required**|
|---|---|---|
|Example: Farm owner|Decision maker|Whether and when to irrigate|
|Example: Farm worker|System user|Required irrigation action|
|Example: Agricultural expert|Knowledge provider|Irrigation rules and thresholds|



### **3.5 Define the Project Objectives** 

Provide two to four measurable objectives. 

Example: 

1. To examine the relationship between environmental conditions and irrigation requirements. 

2. To develop a model for classifying irrigation conditions. 

3. To propose decision rules for recommending irrigation actions. 

Page 4 

**1501418  |  PROJECT GUIDANCE** 

### **3.6 Define the Project Questions** 

Possible questions include: 

- Which variables are most relevant to the selected problem? 

- What patterns can be discovered from the dataset? 

- Which model is appropriate for supporting the decision? 

- How can the model output be converted into a practical action? 

- How will the model be evaluated? 

### **Part 1 Assessment** 

|**Assessment criterion**|**Marks**|
|---|---|
|Clarity of the case and problem context|2|
|Identification of stakeholders and the decision problem|2|
|Evidence-based problem justification|3|
|Clarity of objectives, questions, and expected outcomes|3|
|Part 1 Total|10|



Page 5 

**1501418  |  PROJECT GUIDANCE** 

## **PART 2: DATASET AND DATA MODEL** 

**Weight: 15 Marks** 

### **4.1 Select the Dataset** 

Students may use: 

- Public or open datasets 

- Government datasets 

- Research datasets 

- Organizational datasets with permission 

- Survey data 

- Sensor and Internet of Things data 

- Transaction data 

- Images, audio, video, or text 

- Geographic or spatial data 

- Time-series data 

- Multiple related datasets 

### **4.2 Provide Dataset Information** 

Complete the following table. 

|**Dataset item**|**Project information**|
|---|---|
|**Dataset name**||
|**Dataset provider or owner**||
|**Dataset source or URL**||
|**Data-collection period**||
|**Number of records**||
|**Number of attributes**||
|**Data format**||
|**Target variable, if applicable**||
|**License or usage conditions**||
|**Date accessed**||



Page 6 

**1501418  |  PROJECT GUIDANCE** 

### **4.3 Explain Dataset Relevance** 

Explain: 

- Why the dataset is suitable for the problem 

- How the variables relate to the decision 

- Whether the data are sufficiently complete 

- Whether the data represent the intended population or situation 

- What limitations or biases may exist 

### **4.4 Create a Data Dictionary** 

Describe the important attributes in the dataset. 

|**Variable**|**Data type**|**Description**|**Example**|**Role**|
|---|---|---|---|---|
|Customer_ID|Integer|Unique customer identifier|10001|Identifier|
|Monthly_Usage|Numeric|Monthly service usage|48.5|Input feature|
|Contract_Type|Categorical|Type of service contract|Annual|Input feature|
|Churn|Binary|Whether the customer left|1|Target|



The role of each variable may be: 

- Identifier 

- Input feature 

- Target variable 

- Decision variable 

- Constraint 

- Metadata 

- Variable excluded from the model 

### **4.5 Assess Data Quality** 

The group must examine: 

- Missing values 

- Duplicate records 

- Incorrect or inconsistent values 

Page 7 

**1501418  |  PROJECT GUIDANCE** 

- Outliers 

- Imbalanced classes 

- Data bias 

- Sensitive or personal information 

- Data types and formats 

- Required cleaning and transformation 

Explain how each identified problem will be handled. 

### **4.6 Conduct Exploratory Data Analysis** 

Provide at least three meaningful analyses or visualizations. 

Examples include: 

- Distribution of important variables 

- Comparison between categories 

- Correlation between variables 

- Time-series trends 

- Geographic patterns 

- Target-class distribution 

- Image or text characteristics 

- Relationships between input variables and the target 

Each visualization must include: 

1. A descriptive title 

2. Clearly labeled axes or categories 

3. A short interpretation 

4. An explanation of its relevance to the decision problem 

### **4.7 Design the Data Model** 

Design a model showing how the data will be organized and used. 

Depending on the project, the data model may be: 

- Entity-Relationship Diagram 

- Relational database schema 

- Star schema 

Page 8 

**1501418  |  PROJECT GUIDANCE** 

- Feature table 

- Data pipeline 

- Knowledge graph 

- Document and metadata structure 

- Vector database for a RAG system 

The proposed data model should identify: 

- Entities, tables, or collections 

- Attributes 

- Primary and foreign keys, where applicable 

- Relationships between data elements 

- Input features 

- Target variables 

- Data transformations 

- Data flow from source to model 

### **Part 2 Assessment** 

|**Assessment criterion**|**Marks**|
|---|---|
|Appropriateness and reliability of the dataset|3|
|Dataset description and data dictionary|3|
|Data-quality assessment and preprocessing plan|3|
|Exploratory data analysis and interpretation|3|
|Correctness and clarity of the data model|3|
|Part 2 Total|15|



Page 9 

**1501418  |  PROJECT GUIDANCE** 

## **PART 3: PROPOSED DECISION MODEL** 

##### **Weight: 25 Marks** 

### **5.1 Select the Model Type** 

Select a model that is appropriate for the decision problem. 

|**Model category**|**Possible applications**|
|---|---|
|**Statistical model**|Risk analysis, factor analysis, hypothesis testing|
|**Classification model**|Fraud, disease, risk, or customer-churn classification|
|**Regression model**|Price, demand, yield, or sales prediction|
|**Clustering model**|Customer, farm, product, or community segmentation|
|**Recommendation model**|Product, content, treatment, or activity recommendation|
|**Optimization model**|Scheduling, transportation, production, or resource allocation|
|**Time-series model**|Demand, weather, price, or environmental forecasting|
|**Generative AI/LLM**|Report generation, summarization, and question answering|
|**RAG model**|Evidence-based answers using external documents|
|**Hybrid model**|Combination of rules, ML, optimization, and generative AI|



Students must explain why the selected model is more suitable than possible alternatives. 

### **5.2 Define the Decision Model** 

Complete the following structure. 

|**Component**|**Description**|
|---|---|
|**Model users**|Who will use the model?|
|**Input**|What data will enter the model?|
|**Processing**|What algorithm, method, or rules will be used?|
|**Output**|What result will the model produce?|
|**Decision**|What decision will be supported?|
|**Action**|What will the user do after receiving the result?|
|**Feedback**|How will actual results improve the model?|



Page 10 

**1501418  |  PROJECT GUIDANCE** 

### **5.3 Develop the Model Workflow** 

The proposed workflow should include: 

1. Data collection 

2. Data validation 

3. Data cleaning and preprocessing 

4. Feature selection or feature engineering 

5. Model training or formulation 

6. Model validation and testing 

7. Result interpretation 

8. Decision recommendation 

9. User action 

##### 10. Feedback and model improvement 

Students should present the workflow using a clear diagram. 

### **5.4 Explain the Technical Design** 

#### **For Statistical or Machine-Learning Models** 

Specify: 

- Input features 

- Target variable 

- Selected algorithm 

- Baseline method 

- Training, validation, and testing strategy 

- Parameter or hyperparameter selection 

- Expected model output 

#### **For Optimization Models** 

Specify: 

- Decision variables 

- Objective function 

- Constraints 

- Input parameters 

Page 11 

**1501418  |  PROJECT GUIDANCE** 

- Assumptions 

- Expected optimal solution 

#### **For Generative AI or RAG Models** 

Specify: 

- Source documents or knowledge base 

- Document preparation and chunking 

- Embedding method 

- Vector database 

- Retrieval process 

- Prompt design 

- Response-generation process 

- Citation or grounding method 

- Hallucination-control measures 

#### **For Hybrid Models** 

Explain how the selected methods are connected and how information moves between the models. 

### **5.5 Define Model Evaluation** 

Use measures that match the selected task. 

|**Model task**|**Possible evaluation measures**|
|---|---|
|**Classification**|Accuracy, Precision, Recall, F1-score, ROC-AUC|
|**Regression**|MAE, MSE, RMSE, R²|
|**Clustering**|Silhouette score and expert interpretation|
|**Recommendation**|Precision@K, Recall@K, user satisfaction|
|**Optimization**|Objective value, cost reduction, time saved, resource utilization|
|**Forecasting**|MAE, RMSE, MAPE|
|**LLM/RAG**|Correctness, relevance, faithfulness, groundedness, citation quality|
|**Decision-support system**|Usefulness, usability, acceptance, decision improvement|



Students must define a measurable success criterion. 

Example: 

Page 12 

**1501418  |  PROJECT GUIDANCE** 

_The model will be considered successful if it achieves an F1-score of at least 0.80 and the recommendations are judged useful by at least 80% of test users._ 

### **5.6 Translate the Output into a Decision** 

The model output must lead to a practical decision or action. 

Example: 

|**Model output**|**Decision level**|**Recommended action**|
|---|---|---|
|Risk probability below 0.40|Low|Continue normal monitoring|
|Risk probability 0.40-0.69|Medium|Increase monitoring and notify the responsible person|
|Risk probability 0.70 or higher|High|Take immediate preventive action|



Students must explain: 

- Who receives the result 

- How the result will be displayed 

- What action should be taken 

- Whether human approval is required 

- How the action will be recorded 

### **5.7 Develop a Proof of Concept** 

Each group must provide at least one of the following: 

- Working model prototype 

- Jupyter Notebook 

- Model simulation 

- Optimization spreadsheet 

- Interactive dashboard 

- RAG demonstration 

- User-interface prototype 

- Model pseudocode with sample outputs 

The proof of concept does not need to be a complete production system, but it must demonstrate how the proposed model would work. 

Page 13 

**1501418  |  PROJECT GUIDANCE** 

### **5.8 Explain Benefits, Limitations, and Risks** 

Discuss the expected benefits, such as: 

- Improved decision accuracy 

- Reduced cost 

- Faster decision-making 

- Better resource allocation 

- Reduced risk 

- Improved service quality 

- Social or environmental benefits 

Also discuss: 

- Dataset limitations 

- Model assumptions 

- Bias and fairness 

- Privacy and confidentiality 

- Model explainability 

- Incorrect predictions 

- Generative AI hallucinations 

- Security risks 

- Need for human oversight 

### **Part 3 Assessment** 

|**Assessment criterion**|**Marks**|
|---|---|
|Appropriateness and justification of the selected model|4|
|Completeness of the model architecture and workflow|4|
|Technical correctness of the model formulation|4|
|Evaluation plan, baseline, and success criteria|4|
|Translation of model results into decisions and actions|3|
|Quality of the proof of concept or demonstration|3|
|Benefits, limitations, ethical considerations, and risks|3|
|Part 3 Total|25|



Page 14 

**1501418  |  PROJECT GUIDANCE** 

## **6. Project Deliverables** 

### **6.1 Project Report** 

- Recommended length: 10-15 pages 

- File format: PDF 

- References: APA 7th edition 

- Appendices are not included in the page limit. 

### **6.2 Dataset and Supporting Files (Appendix in report)** 

Submit: 

- Dataset or accessible dataset link 

- Data dictionary 

- Data-cleaning or preprocessing files 

- Source code or notebook 

- Data model diagram 

- Decision-model diagram 

- Demonstration files or application link 

### **6.3 Presentation Slides** 

- Approximately 12-15 slides 

- Presentation time: 15 minutes 

- Question-and-answer session: 5 minutes 

- Every group member must participate. 

## **7. Recommended Report Structure** 

1. Cover Page 

2. Executive Summary 

3. Problem Background 

4. Problem Justification 

5. Stakeholders and Decision Requirements 

6. Project Objectives and Questions 

Page 15 

**1501418  |  PROJECT GUIDANCE** 

7. Dataset Description 

8. Data Dictionary 

9. Data Quality and Preprocessing 

10. Exploratory Data Analysis 

11. Data Model 

12. Proposed Decision Model 

13. Model Architecture and Workflow 

14. Evaluation Plan and Success Criteria 

15. Decision Rules and Recommended Actions 

16. Proof of Concept (Data visualization / Engine / Model simulation .. etc) 

17. Expected Benefits 

18. Limitations, Ethics, and Risks 

19. Conclusion 

20. References 

21. Appendices 

## **8. Recommended Presentation Structure** 

|**Slide**|**Recommended content**|
|---|---|
|1|Project title and group members|
|2|Problem background|
|3|Problem justification and evidence|
|4|Stakeholders and decision problem|
|5|Objectives and project questions|
|6|Dataset overview|
|7|Data quality and preprocessing|
|8|Exploratory data analysis|
|9|Data model|
|10|Proposed decision model / Visualization|
|11|Model workflow or architecture|
|12|Evaluation measures and success criteria|
|13|Decision rules and recommended actions|



Page 16 

**1501418  |  PROJECT GUIDANCE** 

|**Slide**||**Recommended content**|
|---|---|---|
|14|Proof-of-concept demonstration||
|15|Benefits, limitations, and conclusion||



## **9. Overall Project Scoring** 

|**Project component**|**Marks**|**Contribution to course grade**|
|---|---|---|
|Part 1: Problem Identification and Justification|10|10%|
|Part 2: Dataset and Data Model|15|15%|
|Part 3: Proposed Decision Model|25|25%|
|Total Project Score|50|50%|



## **10. Performance Levels** 

|**Level**|**Description**|
|---|---|
|**Excellent**|The project is clear, evidence-based, technically correct, feasible, and strongly connected to a<br>real decision.|
|**Good**|The project is mostly complete and correct, with minor weaknesses in evidence, analysis, or<br>model design.|
|**Satisfactory**|The basic requirements are met, but the analysis, justification, or decision model lacks depth.|
|**Needs Improvement**|The work is incomplete, unclear, technically inappropriate, or weakly connected to a practical<br>decision.|



## **11. Academic Integrity and Responsible AI Use** 

Students must follow these requirements: 

1. Properly cite all datasets, reports, research articles, models, software, and external sources. 

2. Do not present simulated or fabricated data as real data. 

3. Obtain permission before using private organizational data. 

4. Remove or anonymize sensitive and personally identifiable information. 

5. Clearly acknowledge the use of generative AI tools. 

6. Verify all AI-generated content, code, references, and analytical results. 

Page 17 

**1501418  |  PROJECT GUIDANCE** 

7. Do not submit AI-generated work without human review and meaningful student contribution. 

8. Each student must be able to explain the dataset, data model, analytical method, and decision model. 

9. Undeclared copying, plagiarism, or fabrication may result in a score of zero. 

Page 18 

**1501418  |  PROJECT GUIDANCE** 

## **12. Final Submission Checklist** 

Before submitting the project **(1.Report 2. Presentation slides),** confirm that the group has included: 

- ☐ A clearly defined real-world problem 

- ☐ Evidence supporting the importance of the problem 

- ☐ Identified stakeholders and decision requirements 

- ☐ Clear objectives and project questions 

- ☐ A reliable and properly cited dataset 

- ☐ A complete data dictionary 

- ☐ Data-quality and preprocessing analysis 

- ☐ At least three meaningful data visualizations 

- ☐ A clear data model 

- ☐ A justified decision-model approach 

- ☐ A model architecture or workflow diagram 

- ☐ Appropriate evaluation measures 

- ☐ An individual contribution statement for every member 

- ☐ Measurable success criteria 

- ☐ Decision rules connecting model outputs to actions 

- ☐ A proof of concept or demonstration 

- ☐ Discussion of benefits, limitations, ethics, and risks 

- ☐ Complete references in APA 7th edition 

Page 19 

