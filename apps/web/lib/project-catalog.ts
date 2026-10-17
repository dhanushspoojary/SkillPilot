export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description: string;
  tasks: ProjectTask[];
  completed: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  expectedBehavior: string;
  status?: 'passed' | 'failed' | 'pending';
  output?: string;
}

export interface ProjectCatalogItem {
  slug: string;
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedHours: number;
  requiredSkills: string[];
  prerequisites: string[];
  objectives: string[];
  starterCode: string;
  testCases: TestCase[];
  milestones: ProjectMilestone[];
}

export const PROJECT_CATALOG: ProjectCatalogItem[] = [
  {
    slug: 'rest-bookstore-service',
    title: 'Authenticated RESTful Bookstore API',
    description: 'Design and build a clean, typed REST API service with input validation, route handlers, error normalization, and structured status codes.',
    difficulty: 'Beginner',
    estimatedHours: 4,
    requiredSkills: ['rest-apis', 'javascript'],
    prerequisites: ['JavaScript Functions & Objects', 'HTTP Methods'],
    objectives: [
      'Implement GET /api/books with pagination and genre filtering',
      'Implement POST /api/books with payload validation and 400 error handling',
      'Implement GET /api/books/:id with 404 for missing resources',
      'Implement DELETE /api/books/:id ensuring idempotency',
    ],
    starterCode: `// Bookstore REST API Service
// Implement route handlers for GET, POST, GET :id, and DELETE

class BookstoreService {
  constructor() {
    this.books = [
      { id: "1", title: "Clean Code", author: "Robert Martin", year: 2008, inStock: true },
      { id: "2", title: "The Pragmatic Programmer", author: "David Thomas", year: 1999, inStock: true }
    ];
  }

  // GET /books - returns list of books
  listBooks(filter = {}) {
    // TODO: support optional inStock filter
    return this.books;
  }

  // GET /books/:id - returns book by id or null
  getBookById(id) {
    // TODO: implement lookup
    return this.books.find(b => b.id === id) || null;
  }

  // POST /books - validates and adds a new book
  addBook(data) {
    // TODO: validate title, author, year
    if (!data.title || !data.author) {
      throw new Error("Invalid payload: title and author are required");
    }
    const newBook = {
      id: String(this.books.length + 1),
      title: data.title.trim(),
      author: data.author.trim(),
      year: Number(data.year) || 2026,
      inStock: Boolean(data.inStock ?? true)
    };
    this.books.push(newBook);
    return newBook;
  }

  // DELETE /books/:id - removes book by id
  deleteBook(id) {
    const idx = this.books.findIndex(b => b.id === id);
    if (idx >= 0) {
      this.books.splice(idx, 1);
      return true;
    }
    return false;
  }
}

module.exports = { BookstoreService };
`,
    testCases: [
      {
        id: 'tc-1',
        name: 'List all books',
        description: 'Verifies that listBooks returns array with initial seed data.',
        expectedBehavior: 'Returns array containing at least 2 book objects',
      },
      {
        id: 'tc-2',
        name: 'Lookup book by ID',
        description: 'Verifies lookup for valid ID returns object, invalid ID returns null.',
        expectedBehavior: 'getBookById("1") returns Clean Code, getBookById("999") returns null',
      },
      {
        id: 'tc-3',
        name: 'Validate payload on creation',
        description: 'Ensures payload missing title throws descriptive error.',
        expectedBehavior: 'addBook({ author: "Unknown" }) throws Error',
      },
      {
        id: 'tc-4',
        name: 'Delete book idempotency',
        description: 'Verifies book deletion removes item and subsequent check returns null.',
        expectedBehavior: 'deleteBook removes item and returns true',
      },
    ],
    milestones: [
      {
        id: 'm-1',
        title: 'Core Data Modeling & Retrieval',
        description: 'Set up in-memory book collection and implement query methods.',
        completed: false,
        tasks: [
          { id: 't-1', title: 'Define book schema properties', description: 'Ensure id, title, author, year, inStock are tracked', completed: false },
          { id: 't-2', title: 'Implement listBooks method', description: 'Return all books with optional filter support', completed: false },
          { id: 't-3', title: 'Implement getBookById', description: 'Return single book or null if not found', completed: false },
        ],
      },
      {
        id: 'm-2',
        title: 'Mutations & Validation',
        description: 'Implement secure creation and deletion with error boundaries.',
        completed: false,
        tasks: [
          { id: 't-4', title: 'Implement addBook with input validation', description: 'Throw error if title or author is empty', completed: false },
          { id: 't-5', title: 'Implement deleteBook', description: 'Delete matching record cleanly without index corruption', completed: false },
        ],
      },
    ],
  },
  {
    slug: 'sql-analytics-dashboard',
    title: 'Relational Schema & Query Optimization',
    description: 'Create normalized relational tables and write performant SQL queries for student enrollment and grade analytics.',
    difficulty: 'Intermediate',
    estimatedHours: 5,
    requiredSkills: ['sql', 'problem-solving'],
    prerequisites: ['Basic SELECT & JOIN', 'GROUP BY & Aggregations'],
    objectives: [
      'Design 3NF student enrollment and course tables',
      'Write optimized analytical query with window functions or aggregations',
      'Avoid N+1 queries by leveraging composite indexes',
    ],
    starterCode: `-- SQL Relational Schema and Analytics Queries
-- Task 1: Create courses and enrollments tables
-- Task 2: Write query to calculate average grade per department

-- Table Definitions:
CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  department VARCHAR(64) NOT NULL,
  credits INT DEFAULT 3
);

CREATE TABLE IF NOT EXISTS enrollments (
  id VARCHAR(32) PRIMARY KEY,
  student_id VARCHAR(32) NOT NULL,
  course_id VARCHAR(32) REFERENCES courses(id),
  grade_score NUMERIC(5, 2) NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytical Query: Department Performance Summary
SELECT 
  c.department,
  COUNT(DISTINCT e.student_id) AS total_students,
  ROUND(AVG(e.grade_score), 1) AS average_grade,
  MAX(e.grade_score) AS highest_score
FROM courses c
JOIN enrollments e ON e.course_id = c.id
GROUP BY c.department
HAVING COUNT(e.id) > 0
ORDER BY average_grade DESC;
`,
    testCases: [
      {
        id: 'tc-sql-1',
        name: 'Normalized Table Schema',
        description: 'Verifies foreign key relationships between courses and enrollments.',
        expectedBehavior: 'Table enrollments references courses(id)',
      },
      {
        id: 'tc-sql-2',
        name: 'Aggregation by Department',
        description: 'Verifies GROUP BY department computes average_grade correctly.',
        expectedBehavior: 'Query aggregates total_students and average_grade per department',
      },
      {
        id: 'tc-sql-3',
        name: 'Ordering & Filtering',
        description: 'Verifies HAVING and ORDER BY clauses maintain analytical accuracy.',
        expectedBehavior: 'Results sorted by average_grade descending',
      },
    ],
    milestones: [
      {
        id: 'm-sql-1',
        title: 'Schema Normalization',
        description: 'Define relational tables with primary and foreign keys.',
        completed: false,
        tasks: [
          { id: 't-sql-1', title: 'Define courses table with department', description: 'Create courses table with primary key', completed: false },
          { id: 't-sql-2', title: 'Define enrollments with foreign key', description: 'Create enrollments table referencing courses', completed: false },
        ],
      },
      {
        id: 'm-sql-2',
        title: 'Analytical Query Development',
        description: 'Write performant multi-table aggregations.',
        completed: false,
        tasks: [
          { id: 't-sql-3', title: 'Implement JOIN and GROUP BY', description: 'Aggregate average grade per department', completed: false },
        ],
      },
    ],
  },
];
