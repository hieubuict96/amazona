import React from 'react';
import { useSelector } from 'react-redux';
import { Redirect, Route } from 'react-router-dom';

export default function PrivateRoute({ component: Component, ...rest }) { //khi này Component là giá trị của component được truyền vào
  const userSignin = useSelector((state) => state.userSignin);
  const { userInfo } = userSignin;
  return ( //userInfo có giá trị tức là được đăng nhập thì trả về <Component /> và props nếu không thì trả về trang signin
    <Route
      {...rest} //đây là phần props còn lại trong component PrivateRoute trừ prop component
      render={(props) =>
        userInfo ? (
          <Component {...props}></Component>
        ) : (
          <Redirect to="/signin" />
        )
      }
    ></Route>
  );
}
