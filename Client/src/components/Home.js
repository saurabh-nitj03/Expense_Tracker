import React from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaMicrophone, FaChartLine, FaUserShield, FaFileExport } from 'react-icons/fa';

function Home({ isAuthenticated, user }) {
  return (
    <Container>
      <section className="home-hero">
        <h1 className="display-4">Welcome to Personal Expense Tracker</h1>
        <p className="lead mb-4">Track your expenses easily with voice commands and smart analytics</p>
        
        {isAuthenticated ? (
          <div className="hero-buttons">
            <Link to="/expenses">
              <Button variant="primary" size="lg">
                View My Expenses
              </Button>
            </Link>
          </div>
        ) : (
          <div className="hero-buttons">
            <Link to="/register">
              <Button variant="primary" size="lg">
                Get Started
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline-primary" size="lg">
                Login
              </Button>
            </Link>
          </div>
        )}
      </section>

      <section className="features-section mt-5">
        <h2 className="text-center mb-4">Key Features</h2>
        <Row className="g-4">
          <Col md={3}>
            <Card className="feature-card">
              <Card.Body className="text-center">
                <div className="feature-icon">
                  <FaMicrophone />
                </div>
                <Card.Title>Voice Input</Card.Title>
                <Card.Text>
                  Add expenses quickly using voice commands like "spent 500 on groceries"
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="feature-card">
              <Card.Body className="text-center">
                <div className="feature-icon">
                  <FaChartLine />
                </div>
                <Card.Title>Expense Analytics</Card.Title>
                <Card.Text>
                  Visualize your spending patterns and track your budget easily
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="feature-card">
              <Card.Body className="text-center">
                <div className="feature-icon">
                  <FaUserShield />
                </div>
                <Card.Title>Personal Account</Card.Title>
                <Card.Text>
                  Secure login to keep your expense data private and accessible
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="feature-card">
              <Card.Body className="text-center">
                <div className="feature-icon">
                  <FaFileExport />
                </div>
                <Card.Title>Data Export</Card.Title>
                <Card.Text>
                  Export your expense data to Excel for further analysis
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </section>
    </Container>
  );
}

export default Home;