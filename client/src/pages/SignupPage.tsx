import React from 'react';
import SignupForm from '../components/SignupForm';

const SignupPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <SignupForm />
    </div>
  );
};

export default SignupPage;
